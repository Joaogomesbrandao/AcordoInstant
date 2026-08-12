# AcordoInstant

Seguro paramétrico de atraso de voo em contrato inteligente.

**Tarefa final** de Blockchain, Contratos Inteligentes e Direito, ESMA-PB 2026.
Proposta em [`Projeto3_AcordoInstant_proposta.pdf`](./Projeto3_AcordoInstant_proposta.pdf).

## O problema

Um processo por atraso de voo leva de 6 meses a 2 anos no Juizado Especial
Cível. O passageiro precisa juntar provas, procurar advogado e esperar; a
companhia troca um custo previsível por condenações incertas; e o Judiciário
absorve milhares de demandas que poderiam ter sido resolvidas no momento do
atraso.

## A solução

Se o voo atrasa mais de **4 horas**, o contrato deposita **R$ 500,00** na
carteira do passageiro. Automaticamente, sem pedido, sem análise humana e sem
processo.

O passageiro não assina transação nenhuma e não tem botão de saque: só
informa sua chave pública. Se o voo atrasou antes de ele ter conta, o valor
fica guardado em nome do CPF dele e é depositado no instante do cadastro.

O TJPB recebe uma cópia do registro e o **termo de quitação** de cada
pagamento: a prova a ser consultada caso a mesma pessoa ingresse no Juizado
por um dano já quitado.

## Como funciona

```
Companhia embarca o passageiro  →  R$ 500,00 travados no escrow
                ↓
Oráculo apura o voo (fonte externa, fora da cadeia)
                ↓
        atraso > 4 h ?
       ↙                ↘
    sim                  não
     ↓                    ↓
paga o passageiro    devolve a garantia
+ termo de quitação   para a companhia
```

## Rodando

Requer Node.js 22+.

```bash
npm install && npm --prefix frontend install

npm run chain     # terminal 1: rede local
npm run deploy    # terminal 2: implanta e configura tudo
npm run dev       # terminal 2: backend :3001 + frontend :3000
```

Abra `http://localhost:3000`. O deploy grava o endereço do contrato onde o
backend e o frontend leem, e não há endereço para copiar em `.env` nenhum.

O roteiro completo da demonstração está em [`docs/uso.md`](./docs/uso.md).

## Os três perfis

| Perfil | O que faz |
|---|---|
| **Passageiro** | Cadastra-se com nome, CPF e chave pública; acompanha os voos e vê quanto já recebeu |
| **Companhia aérea** | Embarca passageiros (depositando a garantia) e resgata as garantias de voos pontuais |
| **TJPB** | Audita a cópia do registro e os termos de quitação, sem nenhuma ação de escrita |

## LGPD: nenhum dado pessoal na cadeia

O CPF identifica o cliente, mas nunca é publicado. O que vai para a blockchain
é `keccak256(pepper, cpf)`; nome e CPF em claro ficam no servidor.

O pepper existe porque um CPF tem 11 dígitos: o hash do número puro seria
reversível por força bruta e voltaria a ser, na prática, um dado pessoal.

## Logs

Toda movimentação da blockchain é impressa no terminal e gravada em
`logs/blockchain.log`:

```
16:59:34  CHEGADA REPORTADA     G31702 · prevista 03/08 12:20 · real 03/08 17:05 · atraso 4h45 · ATRASADO
                                regra acionada: indenizar passageiros · tx 0xd8b8…a2b0 · bloco 7 · gas 156.228
16:59:34  INDENIZACAO RETIDA    G31702 · R$ 500,00 reservados para 0x7ea2…8b5d · passageiro ainda sem cadastro
                                credito acumulado R$ 500,00
16:59:34  QUITACAO EMITIDA      G31702 · R$ 500,00 · atraso 4h45 · passageiro 0x7ea2…8b5d
                                quitacao dos danos materiais imediatos em 12/08 16:59
```

O log é lido da própria cadeia, bloco a bloco: registra o que o contrato
executou, não o que o backend pediu.

## Estrutura

```
contracts/SeguroVoo.sol   Contrato: termos, escrow, execução e quitação
deploy/                   Implantação e derivação das carteiras dos papéis
backend/                  API dos três perfis, assinatura e observador da cadeia
oracle/                   Base de 20 voos e o serviço que apura on-chain
frontend/                 React + TypeScript, um painel por perfil
docs/                     Arquitetura, diagramas, deploy e roteiro de uso
test/                     30 testes do contrato
logs/                     Registro das movimentações (gerado)
```

## Documentação

- [Arquitetura](./docs/arquitetura.md): componentes, papéis e a fronteira
  on-chain/off-chain
- [Diagrama de componentes](./docs/diagramas/componentes.md)
- [Diagrama de sequência](./docs/diagramas/sequencia.md)
- [Diagrama de classes](./docs/diagramas/classes.md)
- [Deploy e execução](./docs/deploy.md)
- [Roteiro de demonstração](./docs/uso.md)

## Rede

Rede local (Hardhat Network, chainId 31337). A proposta indica a Rede
Blockchain Brasil, permissionada, priorizando segurança e escalabilidade
sobre descentralização total, com custo de transação previsível. O que mudaria
lá é o endpoint e a governança dos nós; o contrato e os papéis são os mesmos.
O TJPB, que aqui é uma conta com acesso de leitura, lá seria um nó validador.

## Testes

```bash
npm test
```

30 testes cobrindo o controle de acesso de cada papel, as bordas da regra
(4 h 05 indeniza, 4 h 00 não), o depósito direto na carteira, a retenção para
CPF sem cadastro e a liberação automática no momento do cadastro.

## Escopo do protótipo

Entregue: o contrato completo, os três painéis, o oráculo com apuração
automática, o sistema de logs, os diagramas e a suíte de testes.

As limitações deliberadas (vínculo CPF↔carteira sem validação documental,
oráculo único, base de voos mockada e ausência de autenticação institucional
nas telas) estão detalhadas em
[docs/arquitetura.md § Limitações conhecidas](./docs/arquitetura.md#limitações-conhecidas).

## Uso de Inteligência Artificial

O grupo definiu o problema, os requisitos e a arquitetura da solução; a IA foi
usada como ferramenta de apoio na implementação e na formalização dos
diagramas, com revisão de cada resultado pelos integrantes.
