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

1. Abra o [Remix](https://remix.ethereum.org/), crie
   `SeguroParametrico.sol` e copie o conteúdo de `contracts/`.
2. Compile com Solidity `0.8.24` ou compatível com `^0.8.24`.
3. Escolha uma conta para ser o oracle e passe seu endereço ao construtor.
4. Troque para a conta da companhia, informe pelo menos `0.01 ETH` em
   **VALUE** e execute `depositarFundo`.
5. Volte à conta do oracle e execute `cadastrarVoo` com um ID, o endereço da
   companhia e uma terceira conta como passageiro.
6. Ainda como oracle, execute `registrarAtraso` com o mesmo ID e `3` horas.
7. Confira:
   - a transação e os eventos `AtrasoRegistrado`, `PagamentoRealizado` e
     `QuitacaoEmitida`;
   - `consultarVoo(id)`, cujo campo `pago` será `true`;
   - `consultarSaldo(empresa)`, reduzido em `0.01 ETH`;
   - o saldo da conta do passageiro, acrescido da indenização.

Para demonstrar fundo insuficiente, cadastre outro ID de voo para uma companhia
sem depósito e registre atraso de `3` horas. A transação será concluída sem
pagamento e a função retornará `Companhia sem fundo suficiente`.

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


