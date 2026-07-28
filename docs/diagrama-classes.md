# Diagrama de classes dos contratos inteligentes

Há apenas um smart contract nesta versão: `SeguroParametrico`. `Voo` é a
struct que ele usa internamente para guardar cada apólice/voo monitorado. O
diagrama abaixo mostra só os elementos que existem dentro do Solidity —
contrato, struct, atributos, funções e a relação de composição entre eles.

A interação do contrato com o Oracle e o Backend (que são código off-chain,
não contratos) está descrita nos diagramas de arquitetura, não aqui: veja
[`diagrama-arquitetura-base.md`](./diagrama-arquitetura-base.md) para a visão
de componentes e [`arquitetura.md`](./arquitetura.md) para o diagrama de
sequência do fluxo completo.

```mermaid
classDiagram
    direction LR

    class SeguroParametrico {
        <<contract>>
        +uint256 LIMIAR_ATRASO_HORAS$
        +uint256 VALOR_MULTA$
        +address oraculo
        -Map~address,uint256~ fundosEmpresas
        -Map~uint256,Voo~ voos
        +SeguroParametrico(address enderecoOraculo)
        +depositarFundo() payable
        +cadastrarVoo(uint256 vooId, address empresa, address passageiro)
        +registrarAtraso(uint256 vooId, uint256 atrasoHoras) bool pagamentoEfetuado, string mensagem
        +calcularMulta(uint256 atrasoHoras) uint256
        +resgatarFundo(uint256 valor)
        +consultarSaldo(address empresa) uint256
        +consultarVoo(uint256 vooId) Voo
    }

    class Voo {
        <<struct>>
        +uint256 id
        +address empresa
        +address passageiro
        +uint256 atrasoHoras
        +bool pago
    }

    SeguroParametrico "1" *-- "0..*" Voo : armazena em voos

    note for SeguroParametrico "Modifier apenasOraculo restringe cadastrarVoo e registrarAtraso ao endereco definido em oraculo"
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
| `oraculo` | `address` | `public immutable` | Único endereço autorizado a cadastrar voos e registrar atrasos. |
| `fundosEmpresas` | `mapping(address => uint256)` | `private` | Saldo de garantia depositado por cada companhia. |
| `voos` | `mapping(uint256 => Voo)` | `private` | Registro de cada voo/apólice pelo seu ID. |

## Funções

| Função | Quem chama | Efeito no estado |
|---|---|---|
| `depositarFundo()` | Companhia | Soma `msg.value` ao saldo da companhia em `fundosEmpresas`. |
| `cadastrarVoo(vooId, empresa, passageiro)` | Oracle | Cria a entrada `voos[vooId]`. |
| `registrarAtraso(vooId, atrasoHoras)` | Oracle | Atualiza `atrasoHoras`; se a multa for devida e houver saldo, debita `fundosEmpresas[empresa]`, marca `pago = true` e transfere ETH ao passageiro. |
| `calcularMulta(atrasoHoras)` | Qualquer um (`pure`) | Não altera estado; retorna `VALOR_MULTA` ou `0`. |
| `resgatarFundo(valor)` | Companhia | Reduz `fundosEmpresas[msg.sender]` e devolve ETH a ela. |
| `consultarSaldo(empresa)` | Qualquer um (`view`) | Leitura de `fundosEmpresas`. |
| `consultarVoo(vooId)` | Qualquer um (`view`) | Leitura de `voos`. |

## Relação entre as classes

`SeguroParametrico` **compõe** `Voo`: cada `Voo` só existe dentro do mapping
`voos` do contrato, não há instância de `Voo` fora dele (por isso a
composição `*--`, e não uma simples associação). É a única relação estrutural
do diagrama porque o protótipo tem um único contrato.

## Eventos

- `FundoDepositado`: comprova a entrada de garantia da companhia.
- `AtrasoRegistrado`: registra o dado enviado pelo oráculo.
- `PagamentoRealizado`: registra a transferência ao passageiro.
- `QuitacaoEmitida`: produz a evidência auditável da quitação.
- `VooCadastrado` e `FundoResgatado`: dão transparência às operações
  auxiliares necessárias ao protótipo.

O contrato aplica *checks-effects-interactions*: reduz o saldo e marca o voo
como pago antes da chamada externa que transfere a indenização.
