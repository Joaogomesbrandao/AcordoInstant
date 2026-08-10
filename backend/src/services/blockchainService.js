import { Contract, JsonRpcProvider, Wallet } from "ethers";

const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

const CONTRACT_ABI = [
  "function depositarEscrow() payable",
  "function criarApolice(uint256 apoliceId, address passageiro, bytes32 referenciaVooHash, bytes32 hashBilhete, bytes32 hashTermos, uint256 limiarAtrasoMinutos, uint256 valorIndenizacao)",
  "function aceitarApolice(uint256 apoliceId)",
  "function registrarStatusOficial(uint256 apoliceId, uint256 atrasoOficialMinutos, bytes32 hashFonteStatus, bytes32 hashQuitacao) returns (bool,string)"
];

function serializeValue(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

function serializeArgs(args) {
  return args.map(serializeValue);
}

export class BlockchainService {
  constructor(config) {
    this.config = config;
  }

  isConfigured() {
    return Boolean(this.config.contractAddress && this.config.rpcUrl);
  }

  async depositEscrow({ amountWei, signerPrivateKey }) {
    const normalizedAmount = this.normalizeBigInt(amountWei, "amountWei");
    return this.executeOrPrepare(
      {
        functionName: "depositarEscrow",
        args: [],
        value: normalizedAmount
      },
      signerPrivateKey
    );
  }

  async registerPolicy(policy, signerPrivateKey) {
    return this.executeOrPrepare(
      {
        functionName: "criarApolice",
        args: [
          BigInt(policy.id),
          policy.passengerAddress,
          policy.hashes.flightRefHash,
          policy.hashes.ticketHash,
          policy.hashes.termsHash,
          BigInt(policy.thresholdMinutes),
          BigInt(policy.compensationWei)
        ]
      },
      signerPrivateKey
    );
  }

  async acceptPolicy(policy, signerPrivateKey) {
    return this.executeOrPrepare(
      {
        functionName: "aceitarApolice",
        args: [BigInt(policy.id)]
      },
      signerPrivateKey
    );
  }

  async registerOfficialStatus(policy, settlement, signerPrivateKey) {
    return this.executeOrPrepare(
      {
        functionName: "registrarStatusOficial",
        args: [
          BigInt(policy.id),
          BigInt(settlement.delayMinutes),
          settlement.statusProofHash,
          settlement.quitacaoHash ?? ZERO_HASH
        ]
      },
      signerPrivateKey || this.config.operatorPrivateKey
    );
  }

  normalizeBigInt(value, fieldName) {
    try {
      const normalized = BigInt(String(value));

      if (normalized <= 0n) {
        throw new Error(`${fieldName} deve ser positivo`);
      }

      return normalized;
    } catch (_error) {
      const error = new Error(`${fieldName} deve ser um inteiro positivo em wei`);
      error.statusCode = 400;
      throw error;
    }
  }

  getPreparedCall(call) {
    return {
      blockchainReady: this.isConfigured(),
      contractAddress: this.config.contractAddress || null,
      rpcUrl: this.config.rpcUrl || null,
      functionName: call.functionName,
      args: serializeArgs(call.args),
      value: call.value ? call.value.toString() : null
    };
  }

  async executeOrPrepare(call, signerPrivateKey) {
    const preparedCall = this.getPreparedCall(call);

    if (!this.isConfigured() || !signerPrivateKey) {
      return {
        executed: false,
        preparedCall,
        reason: !this.isConfigured()
          ? "Backend sem RPC_URL/CONTRACT_ADDRESS configurados"
          : "signerPrivateKey nao informado"
      };
    }

    const provider = new JsonRpcProvider(this.config.rpcUrl, this.config.chainId || undefined);
    const signer = new Wallet(signerPrivateKey, provider);
    const contract = new Contract(this.config.contractAddress, CONTRACT_ABI, signer);

    const txOptions = call.value ? { value: call.value } : {};
    const tx = await contract[call.functionName](...call.args, txOptions);
    const receipt = await tx.wait();

    return {
      executed: true,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
      preparedCall
    };
  }
}

