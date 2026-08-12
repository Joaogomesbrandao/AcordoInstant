// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SeguroVoo
 * @notice Seguro paramétrico de atraso de voo do AcordoInstant.
 *
 * @dev Papéis (conforme a proposta apresentada à ESMA-PB):
 *
 *      - COMPANHIA AÉREA: cadastra o voo, registra a venda da passagem
 *        vinculada ao contrato e deposita a garantia (escrow) de cada
 *        bilhete. É `msg.sender` nessas funções, então o contrato suporta
 *        várias companhias sem nenhuma configuração extra.
 *
 *      - ORÁCULO: única conta autorizada a escrever o horário real de
 *        chegada. É o que garante a imparcialidade do parâmetro: nem a
 *        companhia nem o passageiro conseguem declarar o atraso. O contrato
 *        só "acredita" no dado dessa fonte neutra.
 *
 *      - TJPB: nó validador. Tem o endereço registrado aqui e lê tudo pelas
 *        funções `view`, mas não possui nenhuma função que altere estado —
 *        o Tribunal audita, não interfere no processo.
 *
 *      - PLATAFORMA: vincula o hash do CPF à carteira informada pelo cliente
 *        no cadastro. É o único ponto em que uma conta operacional atua em
 *        nome do passageiro, e ainda assim ela não move dinheiro por
 *        decisão própria: só destrava crédito que já era daquele CPF.
 *
 *      LGPD: nenhum dado pessoal entra na cadeia. O passageiro é
 *      identificado por `hashCpf` (keccak256 do CPF, calculado fora da
 *      blockchain) e o bilhete por `id` (keccak256 do código do voo + o
 *      hashCpf), que é a "identificação do bilhete" da proposta. O CPF em
 *      claro nunca é enviado a este contrato.
 *
 *      O passageiro NÃO assina transações e NÃO precisa sacar nada: quando o
 *      atraso é confirmado, a indenização é depositada direto na carteira
 *      dele. Se o CPF ainda não tiver carteira cadastrada, o valor fica
 *      retido em nome do hash do CPF e é liberado automaticamente no
 *      instante em que o cliente se cadastra informando sua chave pública.
 */
contract SeguroVoo {
    // --- Termos do contrato (registrados na cadeia, como pede a proposta) ---

    /// @notice Atraso, em horas, a partir do qual a indenização é devida.
    uint256 public constant LIMIAR_ATRASO_HORAS = 4;

    /// @notice Indenização fixa por bilhete: R$ 500,00.
    /// @dev Taxa fixa de demonstração desta rede local: 1 ETH = R$ 1.000,00.
    uint256 public constant VALOR_INDENIZACAO = 0.5 ether;

    /// @notice Valor da indenização em centavos de real (R$ 500,00).
    uint256 public constant VALOR_INDENIZACAO_CENTAVOS = 50_000;

    // --- Papéis ---

    address public immutable oraculo;
    address public immutable tjpb;
    address public immutable plataforma;

    // --- Tipos ---

    enum StatusVoo {
        Agendado, // ainda sem horário real reportado pelo oráculo
        Pontual, // chegou dentro do limite: garantia volta para a companhia
        Atrasado // atraso acima do limite: garantia vira indenização
    }

    enum StatusBilhete {
        Ativo, // garantia depositada, voo ainda não apurado
        Indenizado, // passageiro recebeu (ou tem crédito retido)
        GarantiaLiberada // voo pontual, valor devolvido à companhia
    }

    struct Voo {
        string codigo;
        address companhia;
        uint64 partidaPrevista;
        uint64 chegadaPrevista;
        uint64 chegadaReal;
        uint32 atrasoMinutos;
        StatusVoo status;
        uint32 totalBilhetes;
    }

    struct Bilhete {
        bytes32 id;
        bytes32 vooId;
        bytes32 hashCpf;
        uint256 garantia;
        StatusBilhete status;
        uint64 quitadoEm;
    }

    // --- Estado ---

    mapping(bytes32 => Voo) private voos;
    mapping(bytes32 => bytes32[]) private bilhetesDoVoo;
    mapping(bytes32 => Bilhete) private bilhetes;
    mapping(bytes32 => bytes32[]) private bilhetesDoCpf;
    mapping(address => bytes32[]) private voosDaCompanhia;

    /// @notice Carteira que o cliente informou no cadastro, por hash de CPF.
    mapping(bytes32 => address) public carteiraDoCpf;

    /// @notice Indenização apurada antes de o CPF ter carteira cadastrada.
    mapping(bytes32 => uint256) public creditoRetido;

    /// @notice Total já depositado na carteira do cliente, por hash de CPF.
    mapping(bytes32 => uint256) public totalDepositado;

    /// @notice Garantias de voos pontuais, disponíveis para a companhia sacar.
    mapping(address => uint256) public saldoLiberado;

    /// @dev Índice global usado pelo painel de auditoria do TJPB.
    bytes32[] private todosOsVoos;

    // --- Eventos (fonte dos logs do sistema) ---

    event VooCadastrado(
        bytes32 indexed vooId,
        address indexed companhia,
        string codigo,
        uint64 partidaPrevista,
        uint64 chegadaPrevista
    );

    event BilheteRegistrado(
        bytes32 indexed bilheteId,
        bytes32 indexed vooId,
        bytes32 indexed hashCpf,
        address companhia,
        uint256 garantia
    );

    event ChegadaReportada(
        bytes32 indexed vooId,
        string codigo,
        uint64 chegadaPrevista,
        uint64 chegadaReal,
        uint32 atrasoMinutos,
        StatusVoo status
    );

    event IndenizacaoDepositada(
        bytes32 indexed bilheteId,
        bytes32 indexed hashCpf,
        address indexed carteira,
        uint256 valor
    );

    event IndenizacaoRetida(
        bytes32 indexed bilheteId,
        bytes32 indexed hashCpf,
        uint256 valor,
        uint256 creditoAcumulado
    );

    /**
     * @notice Termo de quitação dos danos materiais imediatos daquele bilhete.
     * @dev É a prova que o Tribunal consulta caso o passageiro ingresse com
     *      ação depois de já ter sido indenizado automaticamente.
     */
    event QuitacaoEmitida(
        bytes32 indexed bilheteId,
        bytes32 indexed hashCpf,
        uint256 valor,
        uint32 atrasoMinutos,
        uint64 instante
    );

    event GarantiaLiberadaParaCompanhia(
        bytes32 indexed bilheteId,
        address indexed companhia,
        uint256 valor,
        uint256 saldoLiberado
    );

    event CarteiraVinculada(bytes32 indexed hashCpf, address indexed carteira);

    event GarantiaResgatada(address indexed companhia, uint256 valor, uint256 saldoRestante);

    // --- Modificadores ---

    modifier somenteOraculo() {
        require(msg.sender == oraculo, "Somente o oraculo reporta o voo");
        _;
    }

    modifier somentePlataforma() {
        require(msg.sender == plataforma, "Somente a plataforma vincula carteiras");
        _;
    }

    constructor(address _oraculo, address _tjpb, address _plataforma) {
        require(_oraculo != address(0), "Oraculo invalido");
        require(_tjpb != address(0), "TJPB invalido");
        require(_plataforma != address(0), "Plataforma invalida");

        oraculo = _oraculo;
        tjpb = _tjpb;
        plataforma = _plataforma;
    }

    // --- Identificadores ---

    /// @notice Identificador on-chain de um voo, derivado do código.
    function idDoVoo(string calldata codigo) public pure returns (bytes32) {
        return keccak256(bytes(codigo));
    }

    /// @notice Identificação do bilhete: hash do código do voo + hash do CPF.
    function idDoBilhete(string calldata codigo, bytes32 hashCpf) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(bytes(codigo)), hashCpf));
    }

    // --- Companhia aérea ---

    /**
     * @notice Cadastra um voo com os horários previstos de partida e chegada.
     */
    function cadastrarVoo(
        string calldata codigo,
        uint64 partidaPrevista,
        uint64 chegadaPrevista
    ) external returns (bytes32 vooId) {
        require(bytes(codigo).length > 0, "Informe o codigo do voo");
        require(chegadaPrevista > partidaPrevista, "Chegada deve ser depois da partida");

        vooId = keccak256(bytes(codigo));
        require(voos[vooId].companhia == address(0), "Voo ja cadastrado");

        voos[vooId] = Voo({
            codigo: codigo,
            companhia: msg.sender,
            partidaPrevista: partidaPrevista,
            chegadaPrevista: chegadaPrevista,
            chegadaReal: 0,
            atrasoMinutos: 0,
            status: StatusVoo.Agendado,
            totalBilhetes: 0
        });

        voosDaCompanhia[msg.sender].push(vooId);
        todosOsVoos.push(vooId);

        emit VooCadastrado(vooId, msg.sender, codigo, partidaPrevista, chegadaPrevista);
    }

    /**
     * @notice Registra a passagem de um passageiro e deposita a garantia.
     * @param codigo Código do voo já cadastrado por esta companhia.
     * @param hashCpf keccak256 do CPF do passageiro, calculado fora da cadeia.
     * @dev O valor enviado tem de ser exatamente a indenização prevista na
     *      regra: é ele que fica travado no escrow até o oráculo apurar o voo.
     */
    function registrarBilhete(
        string calldata codigo,
        bytes32 hashCpf
    ) external payable returns (bytes32 bilheteId) {
        bytes32 vooId = keccak256(bytes(codigo));
        Voo storage voo = voos[vooId];

        require(voo.companhia != address(0), "Voo nao cadastrado");
        require(voo.companhia == msg.sender, "Somente a companhia do voo");
        require(voo.status == StatusVoo.Agendado, "Voo ja apurado pelo oraculo");
        require(hashCpf != bytes32(0), "Hash de CPF invalido");
        require(msg.value == VALOR_INDENIZACAO, "Garantia deve ser igual a indenizacao");

        bilheteId = keccak256(abi.encodePacked(vooId, hashCpf));
        require(bilhetes[bilheteId].id == bytes32(0), "Bilhete ja registrado");

        bilhetes[bilheteId] = Bilhete({
            id: bilheteId,
            vooId: vooId,
            hashCpf: hashCpf,
            garantia: msg.value,
            status: StatusBilhete.Ativo,
            quitadoEm: 0
        });

        bilhetesDoVoo[vooId].push(bilheteId);
        bilhetesDoCpf[hashCpf].push(bilheteId);
        voo.totalBilhetes += 1;

        emit BilheteRegistrado(bilheteId, vooId, hashCpf, msg.sender, msg.value);
    }

    /**
     * @notice A companhia saca as garantias devolvidas por voos pontuais.
     */
    function resgatarGarantias(uint256 valor) external {
        require(valor > 0, "Informe um valor");
        require(saldoLiberado[msg.sender] >= valor, "Saldo liberado insuficiente");

        saldoLiberado[msg.sender] -= valor;

        (bool ok, ) = payable(msg.sender).call{value: valor}("");
        require(ok, "Falha no resgate");

        emit GarantiaResgatada(msg.sender, valor, saldoLiberado[msg.sender]);
    }

    // --- Oráculo ---

    /**
     * @notice Escreve o horário real de chegada e executa o contrato.
     * @dev Único ponto de entrada do parâmetro. Ao apurar o voo, todos os
     *      bilhetes são liquidados na mesma transação: acima do limite, cada
     *      passageiro é indenizado; dentro do limite, cada garantia volta a
     *      ficar disponível para a companhia.
     */
    function reportarChegada(
        string calldata codigo,
        uint64 chegadaReal
    ) external somenteOraculo returns (StatusVoo status, uint32 atrasoMinutos) {
        bytes32 vooId = keccak256(bytes(codigo));
        Voo storage voo = voos[vooId];

        require(voo.companhia != address(0), "Voo nao cadastrado");
        require(voo.status == StatusVoo.Agendado, "Voo ja apurado");
        require(chegadaReal > 0, "Chegada real invalida");

        atrasoMinutos = chegadaReal > voo.chegadaPrevista
            ? uint32((chegadaReal - voo.chegadaPrevista) / 60)
            : 0;

        // A comparação é feita em minutos de propósito: um atraso de 4h30
        // precisa contar como "mais de 4 horas", o que a divisão inteira por
        // hora descartaria.
        status = atrasoMinutos > LIMIAR_ATRASO_HORAS * 60 ? StatusVoo.Atrasado : StatusVoo.Pontual;

        // Efeito antes das transferências do laço abaixo: além de refletir o
        // estado real, impede reentrância (uma segunda chamada pararia no
        // require de "Voo ja apurado").
        voo.chegadaReal = chegadaReal;
        voo.atrasoMinutos = atrasoMinutos;
        voo.status = status;

        emit ChegadaReportada(vooId, voo.codigo, voo.chegadaPrevista, chegadaReal, atrasoMinutos, status);

        bytes32[] storage ids = bilhetesDoVoo[vooId];
        for (uint256 i = 0; i < ids.length; i++) {
            if (status == StatusVoo.Atrasado) {
                _indenizar(ids[i], atrasoMinutos);
            } else {
                _devolverGarantia(ids[i], voo.companhia);
            }
        }
    }

    function _indenizar(bytes32 bilheteId, uint32 atrasoMinutos) private {
        Bilhete storage bilhete = bilhetes[bilheteId];
        if (bilhete.status != StatusBilhete.Ativo) return;

        uint256 valor = bilhete.garantia;
        bilhete.status = StatusBilhete.Indenizado;
        bilhete.quitadoEm = uint64(block.timestamp);

        address carteira = carteiraDoCpf[bilhete.hashCpf];

        if (carteira == address(0)) {
            // Cliente ainda não se cadastrou: o valor fica reservado ao CPF e
            // é depositado assim que ele informar a chave pública.
            creditoRetido[bilhete.hashCpf] += valor;
            emit IndenizacaoRetida(bilheteId, bilhete.hashCpf, valor, creditoRetido[bilhete.hashCpf]);
        } else {
            totalDepositado[bilhete.hashCpf] += valor;

            (bool ok, ) = payable(carteira).call{value: valor}("");
            require(ok, "Falha ao depositar indenizacao");

            emit IndenizacaoDepositada(bilheteId, bilhete.hashCpf, carteira, valor);
        }

        emit QuitacaoEmitida(bilheteId, bilhete.hashCpf, valor, atrasoMinutos, uint64(block.timestamp));
    }

    function _devolverGarantia(bytes32 bilheteId, address companhia) private {
        Bilhete storage bilhete = bilhetes[bilheteId];
        if (bilhete.status != StatusBilhete.Ativo) return;

        uint256 valor = bilhete.garantia;
        bilhete.status = StatusBilhete.GarantiaLiberada;
        saldoLiberado[companhia] += valor;

        emit GarantiaLiberadaParaCompanhia(bilheteId, companhia, valor, saldoLiberado[companhia]);
    }

    // --- Plataforma ---

    /**
     * @notice Vincula a carteira informada no cadastro ao hash do CPF e
     *         deposita de imediato tudo que já estava reservado para ele.
     * @dev É o que permite indenizar um passageiro que ainda não era usuário
     *      da plataforma quando o voo atrasou, sem nenhum saque manual.
     */
    function vincularCarteira(bytes32 hashCpf, address carteira) external somentePlataforma {
        require(hashCpf != bytes32(0), "Hash de CPF invalido");
        require(carteira != address(0), "Carteira invalida");
        require(carteiraDoCpf[hashCpf] == address(0), "CPF ja possui carteira vinculada");

        carteiraDoCpf[hashCpf] = carteira;
        emit CarteiraVinculada(hashCpf, carteira);

        uint256 pendente = creditoRetido[hashCpf];
        if (pendente == 0) return;

        creditoRetido[hashCpf] = 0;
        totalDepositado[hashCpf] += pendente;

        (bool ok, ) = payable(carteira).call{value: pendente}("");
        require(ok, "Falha ao liberar credito retido");

        emit IndenizacaoDepositada(bytes32(0), hashCpf, carteira, pendente);
    }

    // --- Consultas (usadas pelos três painéis e pela auditoria do TJPB) ---

    function regraContrato()
        external
        pure
        returns (uint256 limiarHoras, uint256 valorWei, uint256 valorCentavos)
    {
        return (LIMIAR_ATRASO_HORAS, VALOR_INDENIZACAO, VALOR_INDENIZACAO_CENTAVOS);
    }

    function consultarVoo(bytes32 vooId) external view returns (Voo memory) {
        require(voos[vooId].companhia != address(0), "Voo nao cadastrado");
        return voos[vooId];
    }

    function consultarBilhete(bytes32 bilheteId) external view returns (Bilhete memory) {
        require(bilhetes[bilheteId].id != bytes32(0), "Bilhete nao registrado");
        return bilhetes[bilheteId];
    }

    function listarVoosDaCompanhia(address companhia) external view returns (bytes32[] memory) {
        return voosDaCompanhia[companhia];
    }

    function listarBilhetesDoVoo(bytes32 vooId) external view returns (bytes32[] memory) {
        return bilhetesDoVoo[vooId];
    }

    function listarBilhetesDoCpf(bytes32 hashCpf) external view returns (bytes32[] memory) {
        return bilhetesDoCpf[hashCpf];
    }

    /// @notice Índice completo dos voos: base do painel de auditoria do TJPB.
    function listarTodosOsVoos() external view returns (bytes32[] memory) {
        return todosOsVoos;
    }

    function totalDeVoos() external view returns (uint256) {
        return todosOsVoos.length;
    }

    /**
     * @notice Resumo financeiro de um CPF para o painel do cliente.
     * @return depositado Total já creditado na carteira do cliente.
     * @return retido Valor apurado enquanto ele ainda não tinha carteira.
     * @return carteira Carteira vinculada (zero se ainda não se cadastrou).
     */
    function resumoDoCpf(
        bytes32 hashCpf
    ) external view returns (uint256 depositado, uint256 retido, address carteira) {
        return (totalDepositado[hashCpf], creditoRetido[hashCpf], carteiraDoCpf[hashCpf]);
    }

    /**
     * @notice Tudo o que o contrato custodia no momento.
     * @dev Soma três coisas distintas: garantias de bilhetes ainda não
     *      apurados, indenizações retidas à espera do cadastro do cliente e
     *      garantias já liberadas que a companhia ainda não resgatou.
     */
    function saldoCustodiado() external view returns (uint256) {
        return address(this).balance;
    }
}
