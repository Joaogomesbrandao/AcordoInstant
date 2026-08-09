export const CONTRACT_ABI = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "LIMIAR_ATRASO_HORAS",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "VALOR_MULTA",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "depositarFundo",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "vooId", "type": "uint256" },
      { "internalType": "uint256", "name": "horarioPartida", "type": "uint256" },
      { "internalType": "uint256", "name": "horarioChegada", "type": "uint256" }
    ],
    "name": "cadastrarVoo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "vooId", "type": "uint256" }],
    "name": "inscreverNoVoo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "vooId", "type": "uint256" },
      { "internalType": "uint256", "name": "atrasoHorasInformado", "type": "uint256" },
      { "internalType": "uint256", "name": "atrasoHorasOficial", "type": "uint256" }
    ],
    "name": "registrarAtraso",
    "outputs": [
      { "internalType": "bool", "name": "pagamentoEfetuado", "type": "bool" },
      { "internalType": "string", "name": "mensagem", "type": "string" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "atrasoHoras", "type": "uint256" }],
    "name": "calcularMulta",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "valor", "type": "uint256" }],
    "name": "resgatarFundo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "empresa", "type": "address" }],
    "name": "consultarSaldo",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "vooId", "type": "uint256" }],
    "name": "consultarVoo",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "id", "type": "uint256" },
          { "internalType": "address", "name": "empresa", "type": "address" },
          { "internalType": "uint256", "name": "horarioPartida", "type": "uint256" },
          { "internalType": "uint256", "name": "horarioChegada", "type": "uint256" },
          { "internalType": "uint256", "name": "totalPassageiros", "type": "uint256" }
        ],
        "internalType": "struct SeguroParametrico.Voo",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "vooId", "type": "uint256" },
      { "internalType": "address", "name": "passageiro", "type": "address" }
    ],
    "name": "consultarInscricao",
    "outputs": [
      {
        "components": [
          { "internalType": "bool", "name": "inscrito", "type": "bool" },
          { "internalType": "uint256", "name": "atrasoHorasInformado", "type": "uint256" },
          { "internalType": "uint256", "name": "atrasoHorasOficial", "type": "uint256" },
          { "internalType": "bool", "name": "pago", "type": "bool" }
        ],
        "internalType": "struct SeguroParametrico.Inscricao",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "empresa", "type": "address" }],
    "name": "listarVoosDaEmpresa",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "passageiro", "type": "address" }],
    "name": "listarVoosDoPassageiro",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "empresa", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "valor", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "saldoAtual", "type": "uint256" }
    ],
    "name": "FundoDepositado",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "vooId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "empresa", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "horarioPartida", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "horarioChegada", "type": "uint256" }
    ],
    "name": "VooCadastrado",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "vooId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "passageiro", "type": "address" }
    ],
    "name": "PassageiroInscrito",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "vooId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "passageiro", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "atrasoHorasInformado", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "atrasoHorasOficial", "type": "uint256" }
    ],
    "name": "AtrasoRegistrado",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "vooId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "empresa", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "passageiro", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "valor", "type": "uint256" }
    ],
    "name": "PagamentoRealizado",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "uint256", "name": "vooId", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "passageiro", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "valor", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "instante", "type": "uint256" }
    ],
    "name": "QuitacaoEmitida",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "empresa", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "valor", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "saldoRestante", "type": "uint256" }
    ],
    "name": "FundoResgatado",
    "type": "event"
  }
];
