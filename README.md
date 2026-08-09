# AcordoInstant

Protótipo de seguro paramétrico para atraso de voos: a companhia deposita um
fundo de garantia no contrato e cadastra o voo com sua própria carteira; o
passageiro confere o atraso oficial do voo (consultado pelo Oracle) e, ao
confirmar, registra esse atraso no contrato com sua própria carteira. O
contrato calcula a indenização e paga o passageiro automaticamente quando as
condições são satisfeitas, emitindo o evento de quitação.

## Conteúdo

- `contracts/SeguroParametrico.sol`: único smart contract do projeto.
  Funções centrais: `cadastrarVoo` (chamada pela companhia) e
  `registrarAtraso` (chamada pelo passageiro), que calcula a multa e paga o
  passageiro se houver saldo, com `depositarFundo` como função de apoio ao
  fluxo.
- `oracle/oracle.js`: componente off-chain de consulta/integração — busca o
  atraso oficial na fonte de dados do voo e o repassa ao backend. Não possui
  privilégios no contrato e não assina nenhuma transação.
- `docs/diagrama-arquitetura-base.md`: diagrama de arquitetura (componentes,
  o que fica on-chain e o que fica off-chain).
- `docs/arquitetura.md`: diagrama de sequência do fluxo da função central.
- `docs/diagrama-classes.md`: diagrama de classes do contrato — atributos,
  funções e relações.

## Fluxo do Oracle (consulta off-chain)

O Oracle não participa das transações on-chain. Ele apenas consulta o banco
mockado (que representa a fonte/API oficial da companhia) e repassa o atraso
oficial ao backend, que o entrega ao frontend para exibição ao passageiro.
Somente depois de conferir esse valor o passageiro assina, com a própria
carteira, a transação `registrarAtraso(vooId, atrasoHoras)`. A demonstração
abaixo, no Remix, cobre apenas a parte on-chain desse fluxo (as transações
assinadas pela companhia e pelo passageiro); a consulta do atraso oficial
pelo Oracle acontece fora da blockchain e não tem uma tela própria no Remix.

## Demonstração no Remix

1. Acesse [remix.ethereum.org](https://remix.ethereum.org), crie um arquivo `SeguroParametrico.sol` e cole o código do contrato.
2. Vá em **Solidity Compiler**, selecione a versão `0.8.24` e clique em **Compile**.
3. Vá em **Deploy & Run Transactions**, deixe o **Environment** como `Remix VM`. Você terá várias contas de teste com 100 ETH cada — use:
   - **Conta 1** → Companhia aérea
   - **Conta 2** → Passageiro
4. O construtor não recebe argumentos: com qualquer conta selecionada, clique em **Deploy**.
5. **Depósito do escrow:** com a **Conta 1** (Companhia) selecionada, coloque `1` no campo **Value** (unidade `Ether`) e chame `depositarFundo`.
6. **Cadastro do voo:** ainda com a **Conta 1**, coloque **Value = 0** (importante!) e chame `cadastrarVoo(vooId, enderecoDoPassageiro)` — o contrato usa `msg.sender` (a Conta 1) como endereço da empresa automaticamente.
7. **Registro do atraso e pagamento automático:** troque para a **Conta 2** (Passageiro). Com **Value = 0**, chame `registrarAtraso(vooId, atrasoHoras)` — use um valor `> 2` para disparar o pagamento. Confira no console os eventos `AtrasoRegistrado`, `PagamentoRealizado` e `QuitacaoEmitida`.
8. **Conferir o estado:**
   - `consultarSaldo(enderecoDaCompanhia)` → saldo do escrow da companhia, em wei (ex: `980000000000000000` = `0,98 ETH`).
   - `consultarVoo(vooId)` → mostra o voo com `pago: true`.
   - Saldo da carteira do passageiro (Conta 2) aumenta em `0,01 ETH` — visível no dropdown **Account**.
> ⚠️ **Atenção ao campo Value:** ele só deve ter valor diferente de zero na chamada de `depositarFundo` (a única função `payable`). Nas demais funções, deixe **Value = 0**, senão a transação reverte.
> ⚠️ **Atenção à conta selecionada:** `cadastrarVoo` deve ser chamada pela conta da companhia e `registrarAtraso` pela conta do passageiro vinculado ao voo — o contrato usa `msg.sender` para validar isso e reverte caso contrário.

## Regra paramétrica atual

- atraso de até duas horas: nenhuma indenização;
- atraso superior a duas horas: pagamento fixo de `0,01 ETH`;
- saldo insuficiente: atraso registrado, sem pagamento; uma nova tentativa
  pode ser feita após a companhia depositar fundos.

ETH é usado apenas como unidade de demonstração.

## Uso de Inteligência Artificial

Este projeto usou um assistente de IA como ferramenta de apoio, de forma
consciente e supervisionada por integrantes do grupo, não como substituto
das decisões técnicas. O processo foi:

1. o grupo definiu o problema, os requisitos da disciplina e a ideia geral da
   arquitetura (incluindo o diagrama original desenhado à mão pelo grupo);
2. essa ideia foi passada à IA para refinar a arquitetura, escrever o
   contrato e formalizar os diagramas em Mermaid;
3. cada resultado foi revisado por integrantes do grupo: o contrato foi lido
   linha a linha e compilado antes de aceito, os diagramas foram conferidos
   contra a versão original do grupo, e o texto foi ajustado sempre que
   alguma decisão gerada não refletia exatamente o que o grupo pretendia;
4. modelos diferentes de IA foram utilizados para a produção guiada e compreensão
   do código do contrato em Solidity.


