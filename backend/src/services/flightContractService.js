import { Contract, JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers";

// Subconjunto do ABI de contracts/SeguroParametrico.sol usado pelo backend
// para agir em nome da companhia (unica, com chave fixa no servidor). Ver
// frontend/src/contract.ts para o ABI completo usado nas leituras diretas.
const FLIGHT_CONTRACT_ABI = [
  "function depositarFundo() payable",
  "function resgatarFundo(uint256 valor)",
  "function cadastrarVoo(uint256 vooId, uint256 horarioPartida, uint256 horarioChegada)",
  "function inscreverPassageiroPelaEmpresa(uint256 vooId, address passageiro)",
  "function registrarAtrasoPelaEmpresa(uint256 vooId, address passageiro, uint256 atrasoHorasInformado, uint256 atrasoHorasOficial) returns (bool,string)",
  "function consultarSaldo(address empresa) view returns (uint256)",
  "function consultarVoo(uint256 vooId) view returns (tuple(uint256 id, address empresa, uint256 horarioPartida, uint256 horarioChegada, uint256 totalPassageiros))",
  "function listarVoosDaEmpresa(address empresa) view returns (uint256[])"
];

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Ponte entre as rotas /companhia/* e o contrato SeguroParametrico.sol.
 * A companhia e unica e fixa: toda acao aqui e assinada com a mesma chave
 * (config.operatorPrivateKey), nunca com uma chave enviada pelo frontend.
 * Quando o backend nao tem RPC_URL/CONTRACT_ADDRESS/OPERATOR_PRIVATE_KEY
 * configurados, os metodos lancam um erro 503 claro em vez de tentar (e
 * falhar de forma confusa) uma chamada on-chain.
 */
export class FlightContractService {
  constructor(config) {
    this.config = config;
    this._signer = null;
  }

  isConfigured() {
    return Boolean(
      this.config.contractAddress &&
        this.config.rpcUrl &&
        this.config.operatorPrivateKey
    );
  }

  requireConfigured() {
    if (!this.isConfigured()) {
      throw httpError(
        "Backend sem RPC_URL/CONTRACT_ADDRESS/OPERATOR_PRIVATE_KEY configurados para o contrato de voos.",
        503
      );
    }
  }

  getSigner() {
    this.requireConfigured();

    if (!this._signer) {
      const provider = new JsonRpcProvider(
        this.config.rpcUrl,
        this.config.chainId || undefined
      );
      this._signer = new Wallet(this.config.operatorPrivateKey, provider);
    }

    return this._signer;
  }

  getContract() {
    return new Contract(this.config.contractAddress, FLIGHT_CONTRACT_ABI, this.getSigner());
  }

  getCompanyAddress() {
    return this.getSigner().address;
  }

  async consultarSaldo() {
    const contract = this.getContract();
    const saldoWei = await contract.consultarSaldo(this.getCompanyAddress());
    return { saldoEth: formatEther(saldoWei) };
  }

  async listarVoos() {
    const contract = this.getContract();
    const vooIds = await contract.listarVoosDaEmpresa(this.getCompanyAddress());

    const voos = await Promise.all(
      vooIds.map(async (vooId) => {
        const voo = await contract.consultarVoo(vooId);
        return {
          id: voo.id.toString(),
          horarioPartida: Number(voo.horarioPartida),
          horarioChegada: Number(voo.horarioChegada),
          totalPassageiros: voo.totalPassageiros.toString()
        };
      })
    );

    return voos.sort((a, b) => Number(a.id) - Number(b.id));
  }

  async depositarFundo(valorEth) {
    const contract = this.getContract();
    const tx = await contract.depositarFundo({ value: parseValorEth(valorEth) });
    await tx.wait();
    return { txHash: tx.hash };
  }

  async resgatarFundo(valorEth) {
    const contract = this.getContract();
    const tx = await contract.resgatarFundo(parseValorEth(valorEth));
    await tx.wait();
    return { txHash: tx.hash };
  }

  async cadastrarVoo(vooId, horarioPartida, horarioChegada) {
    const contract = this.getContract();
    const tx = await contract.cadastrarVoo(
      parseVooId(vooId),
      ensurePositiveInteger(horarioPartida, "horarioPartida"),
      ensurePositiveInteger(horarioChegada, "horarioChegada")
    );
    await tx.wait();
    return { txHash: tx.hash };
  }

  /**
   * Inscreve um passageiro (identificado pelo endereco da carteira, ja
   * resolvido a partir do nome escolhido na interface da companhia) em um
   * voo que essa mesma companhia cadastrou.
   */
  async inscreverPassageiro(vooId, passageiroEndereco) {
    const contract = this.getContract();
    const tx = await contract.inscreverPassageiroPelaEmpresa(
      parseVooId(vooId),
      passageiroEndereco
    );
    await tx.wait();
    return { txHash: tx.hash };
  }

  async registrarAtraso(vooId, passageiroEndereco, atrasoHorasInformado, atrasoHorasOficial) {
    const contract = this.getContract();
    const tx = await contract.registrarAtrasoPelaEmpresa(
      parseVooId(vooId),
      passageiroEndereco,
      parseHours(atrasoHorasInformado, "atrasoHorasInformado"),
      parseHours(atrasoHorasOficial, "atrasoHorasOficial")
    );
    const receipt = await tx.wait();

    const paid = receipt.logs.some((log) => {
      try {
        return contract.interface.parseLog(log)?.name === "PagamentoRealizado";
      } catch (_error) {
        return false;
      }
    });

    return {
      txHash: tx.hash,
      pago: paid,
      mensagem: paid
        ? "Pagamento e quitacao realizados"
        : Number(atrasoHorasOficial) > 2
          ? "Companhia sem fundo suficiente"
          : "Atraso abaixo do limite de indenizacao"
    };
  }
}

function parseVooId(value) {
  return ensurePositiveInteger(value, "vooId");
}

function ensurePositiveInteger(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw httpError(`${fieldName} deve ser um numero inteiro positivo`);
  }
  return BigInt(normalized);
}

function parseHours(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    throw httpError(`${fieldName} deve ser um numero inteiro nao negativo`);
  }
  return BigInt(normalized);
}

function parseValorEth(value) {
  try {
    const parsed = parseEther(String(value ?? "").trim());
    if (parsed <= 0n) {
      throw new Error("valor deve ser positivo");
    }
    return parsed;
  } catch (_error) {
    throw httpError("valorEth deve ser um numero positivo (ex.: 0.01)");
  }
}
