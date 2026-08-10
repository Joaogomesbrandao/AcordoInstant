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
 *      companhia aérea assina `cadastrarVoo`; o passageiro assina
 *      `inscreverNoVoo` e `registrarAtraso`. Cada voo pode ter vários
 *      passageiros inscritos, mas cada um só recebe indenização quando ele
 *      próprio solicita, com base no atraso oficial confirmado. Os valores
 *      são denominados na moeda nativa da rede (ETH em redes Ethereum).
 */
contract SeguroParametrico {
    uint256 public constant LIMIAR_ATRASO_HORAS = 2;
    uint256 public constant VALOR_MULTA = 0.01 ether;

    mapping(address => uint256) private fundosEmpresas;
    mapping(uint256 => Voo) private voos;
    mapping(uint256 => mapping(address => Inscricao)) private inscricoes;
    mapping(address => uint256[]) private voosPorEmpresa;
    mapping(address => uint256[]) private voosPorPassageiro;

    struct Voo {
        uint256 id;
        address empresa;
        uint256 horarioPartida;
        uint256 horarioChegada;
        uint256 totalPassageiros;
    }

    struct Inscricao {
        bool inscrito;
        uint256 atrasoHorasInformado;
        uint256 atrasoHorasOficial;
        bool pago;
    }

    event FundoDepositado(address indexed empresa, uint256 valor, uint256 saldoAtual);
    event VooCadastrado(
        uint256 indexed vooId,
        address indexed empresa,
        uint256 horarioPartida,
        uint256 horarioChegada
    );
    event PassageiroInscrito(uint256 indexed vooId, address indexed passageiro);
    event PassageiroInscritoPelaEmpresa(
        uint256 indexed vooId,
        address indexed empresa,
        address indexed passageiro
    );
    event AtrasoRegistrado(
        uint256 indexed vooId,
        address indexed passageiro,
        uint256 atrasoHorasInformado,
        uint256 atrasoHorasOficial
    );
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
     * @notice Cadastra um voo com seus horários de partida e chegada.
     * @dev A companhia aérea deve chamar esta função usando sua própria
     *      carteira; `empresa` é sempre `msg.sender`. A companhia não indica
     *      passageiros aqui — cada passageiro se inscreve por conta própria
     *      em `inscreverNoVoo`.
     */
    function cadastrarVoo(
        uint256 vooId,
        uint256 horarioPartida,
        uint256 horarioChegada
    ) external {
        address empresa = msg.sender;

        require(voos[vooId].empresa == address(0), "Voo ja cadastrado");
        require(empresa != address(0), "Empresa invalida");
        require(horarioChegada > horarioPartida, "Horario de chegada deve ser posterior a partida");

        voos[vooId] = Voo({
            id: vooId,
            empresa: empresa,
            horarioPartida: horarioPartida,
            horarioChegada: horarioChegada,
            totalPassageiros: 0
        });

        voosPorEmpresa[empresa].push(vooId);

        emit VooCadastrado(vooId, empresa, horarioPartida, horarioChegada);
    }

    /**
     * @notice O próprio passageiro se inscreve em um voo já cadastrado.
     */
    function inscreverNoVoo(uint256 vooId) external {
        _inscrever(vooId, msg.sender);
        emit PassageiroInscrito(vooId, msg.sender);
    }

    /**
     * @notice A companhia do voo inscreve um passageiro em seu nome,
     *         informando o endereço dele diretamente.
     * @dev Usado quando o passageiro não assina transações por conta
     *      própria (ex.: cadastro feito pela companhia a partir do nome do
     *      passageiro na interface). Só a companhia dona do voo pode chamar
     *      esta função; `inscreverNoVoo` continua disponível para o
     *      passageiro se inscrever por conta própria.
     */
    function inscreverPassageiroPelaEmpresa(uint256 vooId, address passageiro) external {
        Voo storage voo = voos[vooId];
        require(voo.empresa != address(0), "Voo nao cadastrado");
        require(msg.sender == voo.empresa, "Somente a companhia do voo pode inscrever passageiros");

        _inscrever(vooId, passageiro);
        emit PassageiroInscritoPelaEmpresa(vooId, msg.sender, passageiro);
    }

    function _inscrever(uint256 vooId, address passageiro) private {
        Voo storage voo = voos[vooId];
        require(voo.empresa != address(0), "Voo nao cadastrado");
        require(passageiro != address(0), "Passageiro invalido");
        require(!inscricoes[vooId][passageiro].inscrito, "Passageiro ja inscrito neste voo");

        inscricoes[vooId][passageiro] = Inscricao({
            inscrito: true,
            atrasoHorasInformado: 0,
            atrasoHorasOficial: 0,
            pago: false
        });

        voo.totalPassageiros += 1;
        voosPorPassageiro[passageiro].push(vooId);
    }

    /**
     * @notice O passageiro registra o atraso do voo em que está inscrito e
     *         tenta quitar automaticamente a sua indenização.
     * @dev `atrasoHorasInformado` é o valor que o próprio passageiro digitou
     *      (guardado apenas como registro, sem efeito no cálculo). O
     *      pagamento é sempre calculado a partir de `atrasoHorasOficial`, o
     *      valor que o Oracle apurou na fonte de dados e que o passageiro
     *      confirma ao assinar esta transação.
     * @return pagamentoEfetuado Indica se houve transferência ao passageiro.
     * @return mensagem Resultado legível para o backend/interface.
     */
    function registrarAtraso(
        uint256 vooId,
        uint256 atrasoHorasInformado,
        uint256 atrasoHorasOficial
    )
        external
        returns (bool pagamentoEfetuado, string memory mensagem)
    {
        Voo storage voo = voos[vooId];
        require(voo.empresa != address(0), "Voo nao cadastrado");

        Inscricao storage inscricao = inscricoes[vooId][msg.sender];
        require(inscricao.inscrito, "Passageiro nao inscrito neste voo");
        require(!inscricao.pago, "Indenizacao ja paga para este passageiro");

        inscricao.atrasoHorasInformado = atrasoHorasInformado;
        inscricao.atrasoHorasOficial = atrasoHorasOficial;
        emit AtrasoRegistrado(vooId, msg.sender, atrasoHorasInformado, atrasoHorasOficial);

        uint256 multa = calcularMulta(atrasoHorasOficial);
        if (multa == 0) {
            return (false, "Atraso abaixo do limite de indenizacao");
        }

        if (fundosEmpresas[voo.empresa] < multa) {
            return (false, "Companhia sem fundo suficiente");
        }

        // Checks-effects-interactions: atualiza o estado antes da transferencia.
        fundosEmpresas[voo.empresa] -= multa;
        inscricao.pago = true;

        (bool sucesso, ) = payable(msg.sender).call{value: multa}("");
        require(sucesso, "Falha no pagamento");

        emit PagamentoRealizado(vooId, voo.empresa, msg.sender, multa);
        emit QuitacaoEmitida(vooId, msg.sender, multa, block.timestamp);

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

    function consultarInscricao(uint256 vooId, address passageiro) external view returns (Inscricao memory) {
        return inscricoes[vooId][passageiro];
    }

    /**
     * @notice Lista os identificadores dos voos cadastrados por uma companhia.
     */
    function listarVoosDaEmpresa(address empresa) external view returns (uint256[] memory) {
        return voosPorEmpresa[empresa];
    }

    /**
     * @notice Lista os identificadores dos voos em que um passageiro está inscrito.
     */
    function listarVoosDoPassageiro(address passageiro) external view returns (uint256[] memory) {
        return voosPorPassageiro[passageiro];
    }
}
