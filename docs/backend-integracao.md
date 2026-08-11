# Backend e integração com a blockchain

Este documento registra a implementação do fluxo usado pela interface atual.
A implantação do contrato está em [`deploy.md`](./deploy.md).

## Papéis

- A companhia é a única entidade que possui uma chave privada no backend.
- O passageiro possui apenas um endereço Ethereum, usado como destinatário.
- O Oracle é off-chain e alimenta o backend com o status oficial do voo.
- O contrato valida as regras, mantém o escrow e efetua a transferência.

## Passo a passo

1. Execute `npm install` e `npm --prefix frontend install`.
2. Suba a rede de testes local com `npm run chain` (`npx hardhat node`).
3. Compile e implante o contrato com `npm run compile` e `npm run deploy:local`.
4. Configure `RPC_URL`, `CHAIN_ID`, `CONTRACT_ADDRESS` e
   `OPERATOR_PRIVATE_KEY` no `.env` da raiz, e `VITE_RPC_URL` /
   `VITE_CONTRACT_ADDRESS` em `frontend/.env`.
5. Inicie o backend com `npm run dev:backend` ou o sistema completo com
   `npm run dev`.
6. Cadastre o passageiro com nome e endereço no frontend.
7. Semeie o Oracle: `node oracle/oracle.js --flight 1234 --delay 240`.
8. No painel da companhia, deposite o escrow, cadastre o voo e inscreva o
   passageiro. Todas essas operações são assinadas pelo backend.
9. No painel do passageiro, consulte o atraso e confirme a solicitação. O
   backend lê novamente o Oracle e não confia no atraso oficial enviado pelo
   navegador.
10. O backend chama `registrarAtrasoPelaEmpresa`. O contrato verifica a
    companhia, a inscrição, o limiar de duas horas e o saldo; se elegível,
    transfere `0,01 ETH` para o endereço do passageiro.

## Rotas principais

| Rota | Responsabilidade |
| --- | --- |
| `POST /api/internal/flight-status` | Entrada do Oracle mockado |
| `GET /api/passengers` · `POST /api/passengers` | Cadastro e listagem de passageiros (nome ↔ endereço) |
| `POST /voos/:vooId/consultar` | Consulta do atraso oficial |
| `POST /voos/:vooId/registrar-atraso` | Registro e tentativa de pagamento |
| `GET /companhia/saldo` | Saldo do escrow |
| `GET /companhia/voos` | Voos cadastrados pela companhia |
| `POST /companhia/depositar-fundo` | Depósito assinado pela companhia |
| `POST /companhia/resgatar-fundo` | Resgate assinado pela companhia |
| `POST /companhia/voos` | Cadastro on-chain do voo |
| `POST /companhia/voos/:vooId/inscrever` | Inscrição on-chain do beneficiário |

## Como o backend lê o resultado do pagamento

`registrarAtrasoPelaEmpresa` retorna `(bool pagamentoEfetuado, string
mensagem)`, mas esse retorno **não é legível depois que a transação é
minerada** — só valeria em uma simulação (`callStatic`). Por isso o backend
decide pelos eventos do recibo:

- `PagamentoRealizado` → `pago: true`;
- `PagamentoNaoRealizado` → `pago: false`, e o campo `motivo` do evento vira a
  mensagem exibida ao passageiro.

Isso exige que o ABI do backend (`FLIGHT_CONTRACT_ABI`, em
`backend/src/services/flightContractService.js`) declare esses dois eventos —
sem eles, `parseLog` não reconhece nada e todo pagamento seria reportado como
não realizado. `npm run check:abi` verifica exatamente esse tipo de
divergência, no backend e no frontend.

## Detalhes de implementação

- O provider do backend é criado com `cacheTimeout: -1`. Sem isso, duas ações
  seguidas da companhia (por exemplo, depositar o fundo e já cadastrar o voo)
  reaproveitam um `eth_getTransactionCount` em cache e a segunda transação
  falha com *nonce has already been used*.
- A conversão de minutos para horas descarta o excedente (`240` minutos vira
  `4` horas), pois o contrato trabalha com horas inteiras.

## Segurança e limites do protótipo

A chave privada deve permanecer somente no `.env` do backend e nunca ser
enviada pelo frontend. O endpoint interno do Oracle está aberto por ser um
mock acadêmico; em produção ele deve exigir autenticação, assinatura da fonte
e controle de replay.

O contrato não expõe nenhuma função em que o beneficiário informe o próprio
atraso oficial — esse número entra apenas na transação assinada pela
companhia, com o valor relido do Oracle no momento do registro.
