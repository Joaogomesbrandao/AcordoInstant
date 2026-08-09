// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SeguroParametrico
 * @notice Protótipo de seguro para atrasos de voos.
 * @dev O Oracle (oracle/oracle.js) é um serviço off-chain de consulta/integração:
 *      ele apenas busca o atraso oficial junto à fonte de dados e o repassa ao
 *      restante do sistema, sem privilégios especiais neste contrato e sem
 *      assinar transações em nome de terceiros. As chamadas on-chain são feitas
 *      diretamente pelas carteiras dos próprios atores responsáveis: a
 *      companhia aérea assina `cadastrarVoo` e o passageiro assina
 *      `registrarAtraso`. Os valores são denominados na moeda nativa da rede
 *      (ETH em redes Ethereum).
 */
contract SeguroParametrico {
    uint256 public constant LIMIAR_ATRASO_HORAS = 2;
    uint256 public constant VALOR_MULTA = 0.01 ether;

    mapping(address => uint256) private fundosEmpresas;
    mapping(uint256 => Voo) private voos;

    struct Voo {
        uint256 id;
        address empresa;
        address passageiro;
        uint256 atrasoHoras;
        bool pago;
    }

    event FundoDepositado(address indexed empresa, uint256 valor, uint256 saldoAtual);
    event VooCadastrado(
        uint256 indexed vooId,
        address indexed empresa,
        address indexed passageiro
    );
    event AtrasoRegistrado(uint256 indexed vooId, uint256 atrasoHoras);
    event PagamentoRealizado(
        uint256 indexed vooId,
        address indexed empresa,
        address indexed passageiro,
        uint256 valor
    );
    event QuitacaoEmitida(
        uint256 indexed vooId,
        address indexed passageiro,
        uint256 valor,
        uint256 instante
    );
    event FundoResgatado(address indexed empresa, uint256 valor, uint256 saldoRestante);

    constructor() {}

    /**
     * @notice Deposita o fundo que garante os pagamentos da companhia.
     */
    function depositarFundo() external payable {
        require(msg.value > 0, "Informe um valor");

        fundosEmpresas[msg.sender] += msg.value;

        emit FundoDepositado(msg.sender, msg.value, fundosEmpresas[msg.sender]);
    }

    /**
     * @notice Vincula o identificador do voo à companhia que chama a função e
     *         ao passageiro informado.
     * @dev A companhia aérea deve chamar esta função usando sua própria
     *      carteira; `empresa` é sempre `msg.sender`, nunca um parâmetro.
     */
    function cadastrarVoo(
        uint256 vooId,
        address passageiro
    ) external {
        address empresa = msg.sender;

        require(voos[vooId].empresa == address(0), "Voo ja cadastrado");
        require(empresa != address(0), "Empresa invalida");
        require(passageiro != address(0), "Passageiro invalido");

        voos[vooId] = Voo({
            id: vooId,
            empresa: empresa,
            passageiro: passageiro,
            atrasoHoras: 0,
            pago: false
        });

        emit VooCadastrado(vooId, empresa, passageiro);
    }

    /**
     * @notice Registra o atraso e tenta quitar automaticamente a indenização.
     * @dev Chamada pelo próprio passageiro vinculado ao voo, usando o atraso
     *      oficial que o Oracle consultou e repassou off-chain (o passageiro
     *      confirma essa informação antes de assinar a transação).
     * @return pagamentoEfetuado Indica se houve transferência ao passageiro.
     * @return mensagem Resultado legível para o backend/interface.
     */
    function registrarAtraso(
        uint256 vooId,
        uint256 atrasoHoras
    )
        external
        returns (bool pagamentoEfetuado, string memory mensagem)
    {
        Voo storage voo = voos[vooId];
        require(voo.empresa != address(0), "Voo nao cadastrado");
        require(
            msg.sender == voo.passageiro,
            "Somente passageiro pode registrar atraso"
        );
        require(!voo.pago, "Voo ja pago");

        voo.atrasoHoras = atrasoHoras;
        emit AtrasoRegistrado(vooId, atrasoHoras);

        uint256 multa = calcularMulta(atrasoHoras);
        if (multa == 0) {
            return (false, "Atraso abaixo do limite de indenizacao");
        }

        if (fundosEmpresas[voo.empresa] < multa) {
            return (false, "Companhia sem fundo suficiente");
        }

        // Checks-effects-interactions: atualiza o estado antes da transferencia.
        fundosEmpresas[voo.empresa] -= multa;
        voo.pago = true;

        (bool sucesso, ) = payable(voo.passageiro).call{value: multa}("");
        require(sucesso, "Falha no pagamento");

        emit PagamentoRealizado(vooId, voo.empresa, voo.passageiro, multa);
        emit QuitacaoEmitida(vooId, voo.passageiro, multa, block.timestamp);

        return (true, "Pagamento e quitacao realizados");
    }

    /**
     * @notice Calcula a indenização fixa para atrasos superiores a duas horas.
     */
    function calcularMulta(uint256 atrasoHoras) public pure returns (uint256) {
        if (atrasoHoras > LIMIAR_ATRASO_HORAS) {
            return VALOR_MULTA;
        }

        return 0;
    }

    /**
     * @notice Permite que a companhia retire parte do próprio saldo não pago.
     */
    function resgatarFundo(uint256 valor) external {
        require(valor > 0, "Informe um valor");
        require(fundosEmpresas[msg.sender] >= valor, "Saldo insuficiente");

        fundosEmpresas[msg.sender] -= valor;

        (bool sucesso, ) = payable(msg.sender).call{value: valor}("");
        require(sucesso, "Falha no resgate");

        emit FundoResgatado(msg.sender, valor, fundosEmpresas[msg.sender]);
    }

    function consultarSaldo(address empresa) external view returns (uint256) {
        return fundosEmpresas[empresa];
    }

    function consultarVoo(uint256 vooId) external view returns (Voo memory) {
        require(voos[vooId].empresa != address(0), "Voo nao cadastrado");
        return voos[vooId];
    }
}