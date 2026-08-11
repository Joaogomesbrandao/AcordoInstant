# Diagrama de classes dos contratos inteligentes

Há apenas um smart contract nesta versão: `SeguroParametrico`. `Voo` e
`Inscricao` são as structs que ele usa internamente: `Voo` guarda os dados do
voo cadastrado pela companhia, e `Inscricao` guarda, para cada par
(voo, passageiro), o estado individual de inscrição, atraso e pagamento. O
diagrama abaixo mostra só os elementos que existem dentro do Solidity —
contrato, structs, atributos, funções e as relações de composição entre eles.

A interação do contrato com o backend e com componentes off-chain (incluindo
o Oracle, que atua como ponte de integração) está descrita nos diagramas de
arquitetura, não aqui: veja
[`diagrama-arquitetura-base.mmd`](./diagrama-arquitetura-base.mmd) para a visão
de componentes e [`arquitetura.md`](./arquitetura.md) para o diagrama de
sequência do fluxo completo.

```mermaid
classDiagram
    direction LR

    class SeguroParametrico {
        <<contract>>
        +uint256 LIMIAR_ATRASO_HORAS$
        +uint256 VALOR_MULTA$
        -Map~address,uint256~ fundosEmpresas
        -Map~uint256,Voo~ voos
        -Map~uint256,Map~address,Inscricao~~ inscricoes
        -Map~address,uint256[]~ voosPorEmpresa
        -Map~address,uint256[]~ voosPorPassageiro
        +SeguroParametrico()
        +depositarFundo() payable
        +cadastrarVoo(uint256 vooId, uint256 horarioPartida, uint256 horarioChegada)
        +inscreverNoVoo(uint256 vooId)
        +inscreverPassageiroPelaEmpresa(uint256 vooId, address passageiro)
        +registrarAtrasoPelaEmpresa(uint256 vooId, address passageiro, uint256 atrasoHorasInformado, uint256 atrasoHorasOficial) bool pagamentoEfetuado, string mensagem
        -_inscrever(uint256 vooId, address passageiro)
        -_registrarAtraso(uint256 vooId, address passageiro, uint256 atrasoHorasInformado, uint256 atrasoHorasOficial) bool, string
        +calcularMulta(uint256 atrasoHoras) uint256
        +resgatarFundo(uint256 valor)
        +consultarSaldo(address empresa) uint256
        +consultarVoo(uint256 vooId) Voo
        +consultarInscricao(uint256 vooId, address passageiro) Inscricao
        +listarVoosDaEmpresa(address empresa) uint256[]
        +listarVoosDoPassageiro(address passageiro) uint256[]
    }

    class Voo {
        <<struct>>
        +uint256 id
        +address empresa
        +uint256 horarioPartida
        +uint256 horarioChegada
        +uint256 totalPassageiros
    }

    class Inscricao {
        <<struct>>
        +bool inscrito
        +uint256 atrasoHorasInformado
        +uint256 atrasoHorasOficial
        +bool pago
        +bool registrado
    }

    SeguroParametrico "1" *-- "0..*" Voo : armazena em voos
    SeguroParametrico "1" *-- "0..*" Inscricao : armazena em inscricoes

    note for SeguroParametrico "cadastrarVoo usa msg.sender como empresa. Como o passageiro nao possui chave privada, a companhia dona do voo e quem assina a inscricao e o registro de atraso; o endereco do passageiro entra por parametro e e usado como beneficiario. Cada voo pode ter varios passageiros inscritos, mas cada Inscricao e paga de forma independente. O Oracle nao faz parte da estrutura interna do contrato, pois e um componente off-chain sem privilegios aqui."
```

`$` marca `LIMIAR_ATRASO_HORAS` e `VALOR_MULTA` como membros `constant`, ou
seja, compartilhados pelo contrato e não por instância — na prática, como só
existe um deploy do contrato, isso não muda o comportamento, mas reflete a
declaração Solidity (`constant`).

## Atributos

| Atributo | Tipo | Visibilidade | Papel |
|---|---|---|---|
| `LIMIAR_ATRASO_HORAS` | `uint256` | `public constant` | Atraso mínimo (em horas) que gera indenização. |
| `VALOR_MULTA` | `uint256` | `public constant` | Valor fixo pago ao passageiro quando a indenização é devida. |
| `fundosEmpresas` | `mapping(address => uint256)` | `private` | Saldo de garantia depositado por cada companhia. |
| `voos` | `mapping(uint256 => Voo)` | `private` | Registro de cada voo pelo seu ID. |
| `inscricoes` | `mapping(uint256 => mapping(address => Inscricao))` | `private` | Estado de cada passageiro dentro de um voo. |
| `voosPorEmpresa` | `mapping(address => uint256[])` | `private` | Índice reverso: voos cadastrados por cada companhia. |
| `voosPorPassageiro` | `mapping(address => uint256[])` | `private` | Índice reverso: voos em que cada passageiro está inscrito. |

### Campos da `Inscricao`

| Campo | Papel |
|---|---|
| `inscrito` | O passageiro faz parte deste voo. |
| `atrasoHorasInformado` | O que o passageiro digitou na interface; fica só como registro. |
| `atrasoHorasOficial` | O que o Oracle apurou; é o único valor usado no cálculo. |
| `pago` | A indenização já foi transferida para este passageiro. |
| `registrado` | A solicitação já foi feita, mesmo que sem direito a pagamento. É o que permite à interface distinguir "ainda não solicitou" de "solicitou e não tinha direito". |

## Funções

| Função | Quem chama | Efeito no estado |
|---|---|---|
| `depositarFundo()` | Companhia | Soma `msg.value` ao saldo da companhia em `fundosEmpresas`. |
| `cadastrarVoo(vooId, horarioPartida, horarioChegada)` | Companhia | Cria a entrada `voos[vooId]` e a adiciona a `voosPorEmpresa[msg.sender]`. |
| `inscreverNoVoo(vooId)` | Passageiro (autoinscrição) | Cria `inscricoes[vooId][msg.sender]`, incrementa `totalPassageiros` e adiciona o voo a `voosPorPassageiro[msg.sender]`. Não é usada pela interface atual, em que o passageiro não assina transações. |
| `inscreverPassageiroPelaEmpresa(vooId, passageiro)` | Companhia dona do voo | Mesmo efeito de `inscreverNoVoo`, mas para o endereço informado. É o caminho usado pela interface. |
| `registrarAtrasoPelaEmpresa(vooId, passageiro, atrasoHorasInformado, atrasoHorasOficial)` | Companhia dona do voo | Atualiza a `Inscricao` do passageiro e marca `registrado = true`; se a multa (calculada sobre `atrasoHorasOficial`) for devida e houver saldo, debita `fundosEmpresas[empresa]`, marca `pago = true` e transfere ETH ao passageiro. `atrasoHorasInformado` fica apenas registrado, sem efeito no cálculo. |
| `calcularMulta(atrasoHoras)` | Qualquer um (`pure`) | Não altera estado; retorna `VALOR_MULTA` ou `0`. |
| `resgatarFundo(valor)` | Companhia | Reduz `fundosEmpresas[msg.sender]` e devolve ETH a ela. |
| `consultarSaldo(empresa)` | Qualquer um (`view`) | Leitura de `fundosEmpresas`. |
| `consultarVoo(vooId)` | Qualquer um (`view`) | Leitura de `voos`. |
| `consultarInscricao(vooId, passageiro)` | Qualquer um (`view`) | Leitura de `inscricoes`. |
| `listarVoosDaEmpresa(empresa)` | Qualquer um (`view`) | Leitura de `voosPorEmpresa`. |
| `listarVoosDoPassageiro(passageiro)` | Qualquer um (`view`) | Leitura de `voosPorPassageiro`. |

Não existe função pública em que o **beneficiário** informe o próprio atraso
oficial: isso permitiria a qualquer endereço inscrito declarar um atraso
arbitrário e sacar o fundo da companhia. O atraso oficial só entra no contrato
pela transação assinada pela companhia, com o valor lido do Oracle.

## Relação entre as classes

`SeguroParametrico` **compõe** `Voo` e `Inscricao`: nenhuma das duas structs
existe fora dos mappings do contrato (`voos` e `inscricoes`), por isso a
composição `*--`, e não uma simples associação. Um `Voo` pode estar associado
a várias `Inscricao` (uma por passageiro), mas cada `Inscricao` é resolvida
de forma independente — o pagamento de um passageiro não depende do estado
dos demais inscritos no mesmo voo.

## Eventos

- `FundoDepositado`: comprova a entrada de garantia da companhia.
- `VooCadastrado`: registra o cadastro do voo pela companhia, com seus horários.
- `PassageiroInscrito`: registra a autoinscrição de um passageiro em um voo.
- `PassageiroInscritoPelaEmpresa`: registra a inscrição feita pela companhia
  em nome do passageiro.
- `AtrasoRegistrado`: registra o atraso informado e o atraso oficial usados na
  solicitação; o endereço indexado é sempre o do **passageiro beneficiário**,
  não o de quem assinou a transação.
- `PagamentoRealizado`: registra a transferência ao passageiro.
- `QuitacaoEmitida`: produz a evidência auditável da quitação.
- `PagamentoNaoRealizado`: registra o motivo de uma solicitação não ter gerado
  pagamento (atraso abaixo do limite ou companhia sem fundo). É a partir dele
  que o backend informa o motivo exato ao passageiro, já que o valor de
  retorno da função não é legível depois que a transação é minerada.
- `FundoResgatado`: dá transparência ao resgate de saldo pela companhia.

O contrato aplica *checks-effects-interactions*: reduz o saldo e marca a
inscrição como paga antes da chamada externa que transfere a indenização.
