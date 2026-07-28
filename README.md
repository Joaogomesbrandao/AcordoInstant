# AcordoInstant

Protótipo de seguro paramétrico para atraso de voos: a companhia deposita um
fundo de garantia no contrato e, quando um atraso relevante é registrado, o
contrato calcula a indenização e paga o passageiro automaticamente, emitindo
o evento de quitação.

## Conteúdo

- `contracts/SeguroParametrico.sol`: único smart contract do projeto. Função
  central: `registrarAtraso`, que calcula a multa e paga o passageiro se
  houver saldo, com `depositarFundo` como função de apoio ao fluxo.
- `docs/diagrama-arquitetura-base.md`: diagrama de arquitetura (componentes,
  o que fica on-chain e o que fica off-chain).
- `docs/arquitetura.md`: diagrama de sequência do fluxo da função central.
- `docs/diagrama-classes.md`: diagrama de classes do contrato — atributos,
  funções e relações.

## Demonstração no Remix

1. Acesse [remix.ethereum.org](https://remix.ethereum.org), crie um arquivo `SeguroParametrico.sol` e cole o código do contrato.
2. Vá em **Solidity Compiler**, selecione a versão `0.8.24` e clique em **Compile**.
3. Vá em **Deploy & Run Transactions**, deixe o **Environment** como `Remix VM`. Você terá várias contas de teste com 100 ETH cada — use:
   - **Conta 1** → Oráculo
   - **Conta 2** → Companhia aérea
   - **Conta 3** → Passageiro
4. Com a **Conta 1** selecionada, cole o endereço da própria **Conta 1** no campo do construtor e clique em **Deploy**.
5. **Depósito do escrow:** troque para a **Conta 2**, coloque `1` no campo **Value** (unidade `Ether`) e chame `depositarFundo`.
6. **Cadastro do voo:** volte para a **Conta 1**. Coloque **Value = 0** (importante!) e chame `cadastrarVoo(vooId, enderecoEmpresa, enderecoPassageiro)`.
7. **Registro do atraso e pagamento automático:** ainda na Conta 1, com **Value = 0**, chame `registrarAtraso(vooId, atrasoHoras)` — use um valor `> 2` para disparar o pagamento. Confira no console os eventos `AtrasoRegistrado`, `PagamentoRealizado` e `QuitacaoEmitida`.
8. **Conferir o estado:**
   - `consultarSaldo(enderecoEmpresa)` → saldo do escrow da companhia, em wei (ex: `980000000000000000` = `0,98 ETH`).
   - `consultarVoo(vooId)` → mostra o voo com `pago: true`.
   - Saldo da carteira do passageiro (Conta 3) aumenta em `0,01 ETH` — visível no dropdown **Account**.
> ⚠️ **Atenção ao campo Value:** ele só deve ter valor diferente de zero na chamada de `depositarFundo` (a única função `payable`). Nas demais funções, deixe **Value = 0**, senão a transação reverte.

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
   alguma decisão gerada não refletia exatamente o que o grupo pretendia.
4. modelos diferentes de IA foram utilizados para a produção guiada e compreensão
   do código do contrato em Solidity.


