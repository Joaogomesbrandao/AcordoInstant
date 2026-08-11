# Backend e integração com a blockchain

Este documento registra a implementação do fluxo usado pela interface atual.

## Papéis

- A companhia é a única entidade que possui uma chave privada no backend.
- O passageiro possui apenas um endereço Ethereum, usado como destinatário.
- O Oracle é off-chain e alimenta o backend com o status oficial do voo.
- O contrato valida as regras, mantém o escrow e efetua a transferência.

## Passo a passo

1. Execute `npm install` e `npm --prefix frontend install`.
2. Inicie uma rede EVM local ou conecte uma rede de testes.
3. Compile e implante `contracts/SeguroParametrico.sol`.
4. Configure `RPC_URL`, `CHAIN_ID`, `CONTRACT_ADDRESS` e
   `OPERATOR_PRIVATE_KEY` no `.env` da raiz.
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
| `POST /voos/:vooId/consultar` | Consulta do atraso oficial |
| `POST /voos/:vooId/registrar-atraso` | Registro e tentativa de pagamento |
| `GET /companhia/saldo` | Saldo do escrow |
| `POST /companhia/depositar-fundo` | Depósito assinado pela companhia |
| `POST /companhia/voos` | Cadastro on-chain do voo |
| `POST /companhia/voos/:vooId/inscrever` | Inscrição on-chain do beneficiário |

## Segurança e limites do protótipo

A chave privada deve permanecer somente no `.env` do backend e nunca ser
enviada pelo frontend. O endpoint interno do Oracle está aberto por ser um
mock acadêmico; em produção ele deve exigir autenticação, assinatura da fonte
e controle de replay. A conversão atual descarta minutos excedentes (`240`
minutos vira `4` horas), pois o contrato trabalha com horas inteiras.
