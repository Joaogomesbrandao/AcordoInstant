# Arquitetura do AcordoInstant

Seguro paramétrico de atraso de voo em contrato inteligente. Este documento
descreve os componentes, quem pode fazer o quê e — o ponto central — onde
está a fronteira entre o que vai para a blockchain e o que fica fora dela.

Os diagramas estão em [`diagramas/`](./diagramas/):
[componentes](./diagramas/componentes.md) ·
[sequência](./diagramas/sequencia.md) ·
[classes](./diagramas/classes.md).

## O problema que a arquitetura resolve

Hoje, um passageiro que sofre atraso precisa juntar provas, procurar um
advogado e entrar no Juizado. O processo leva de 6 meses a 2 anos, e o custo
recai sobre o Judiciário, sobre a companhia e sobre o consumidor.

A solução troca a disputa por um parâmetro objetivo: se o voo atrasou mais de
4 horas, o contrato paga R$ 500,00 automaticamente. Não há análise humana,
não há pedido a fazer e não há processo a distribuir.

## Componentes

| Componente | Onde roda | Papel |
|---|---|---|
| `contracts/SeguroVoo.sol` | Blockchain | Termos, escrow, execução do pagamento e termo de quitação |
| `oracle/` | Fora da cadeia | Fonte do horário real de chegada e serviço que o escreve on-chain |
| `backend/` | Fora da cadeia | API dos três perfis, assinatura por papel, dados pessoais e logs |
| `frontend/` | Navegador | Telas do passageiro, da companhia e do TJPB |
| `deploy/` | Script | Implanta o contrato e deriva as carteiras dos papéis |

## Os quatro papéis

Cada papel tem uma carteira própria, derivada na implantação
(`deploy/contas.js`). O controle de acesso do contrato é o que impede que um
papel faça o trabalho de outro — não é uma convenção do backend.

**Companhia aérea** (conta #0) — cadastra o voo, registra a venda da passagem
vinculada ao contrato e deposita a garantia de cada bilhete. Depois disso, não
decide mais nada sobre aquele bilhete.

**Oráculo** (conta #1) — única conta autorizada a escrever o horário real de
chegada. Representa as fontes de dados oficiais (ANAC, Infraero, FlightStats)
da proposta. É o que garante a imparcialidade: nem a companhia nem o
passageiro conseguem declarar um atraso.

**TJPB** (conta #2) — nó validador. Tem o endereço registrado no contrato e lê
tudo pelas funções `view`, mas **não existe nenhuma função de escrita
disponível a ele**. O Tribunal audita; não interfere.

**Plataforma** (conta #3) — vincula o hash do CPF à carteira que o cliente
informa no cadastro. É o único ponto em que uma conta operacional age em nome
do passageiro, e ainda assim ela não escolhe valores: apenas destrava crédito
que já pertencia àquele CPF.

## A fronteira on-chain / off-chain

Esta é a decisão de projeto mais importante do sistema.

### O que vai para a blockchain

- **Termos do contrato** — `LIMIAR_ATRASO_HORAS` e `VALOR_INDENIZACAO` são
  constantes públicas. Qualquer parte lê a mesma regra.
- **Identificação do bilhete** — `keccak256(hash do voo, hash do CPF)`.
- **Status do voo** — horário previsto, horário real e atraso apurado.
- **Confirmação de pagamento** — evento `IndenizacaoDepositada`.
- **Termo de quitação** — evento `QuitacaoEmitida`, com valor, atraso e
  instante.

### O que nunca vai para a blockchain

- Nome, CPF em claro e qualquer outro dado pessoal.

O passageiro é identificado por `hashCpf`. O CPF em claro fica em
`data/clientes.json` (cadastro) e `data/manifesto.json` (manifesto da
companhia), ambos no servidor.

### Por que o hash tem pepper

Um CPF tem 11 dígitos. Um `keccak256` do número puro seria reversível por
força bruta em minutos, e o hash publicado voltaria a ser, na prática, um dado
pessoal. Por isso `lib/cpf.js` calcula `keccak256(pepper, cpf)` com um segredo
que nunca sai do servidor.

Em produção, esse pepper viveria em um HSM ou cofre de segredos, com política
de rotação própria. Aqui ele vem de `CPF_PEPPER`, com um valor padrão para a
demonstração rodar sem configuração.

## O fluxo

1. A companhia embarca o passageiro: `registrarBilhete(codigo, hashCpf)` com
   `msg.value` igual à indenização. O dinheiro fica travado no contrato.
2. O oráculo varre os voos pendentes, encontra o código na base externa e
   chama `reportarChegada(codigo, chegadaReal)`.
3. O contrato calcula o atraso e aplica a regra **na mesma transação**:
   - acima de 4 h → cada passageiro do voo é indenizado e recebe um termo de
     quitação;
   - dentro do limite → cada garantia volta a ficar disponível para a
     companhia resgatar.
4. Se o CPF já tem carteira vinculada, o valor é depositado direto nela. Se
   não tem, fica retido em nome do hash do CPF.
5. Quando essa pessoa se cadastra informando a chave pública, o contrato
   vincula a carteira e deposita tudo o que estava retido — na mesma
   transação do cadastro.

O passageiro nunca assina uma transação e nunca pede o dinheiro. Não existe
função de saque para ele no contrato: só existe depósito.

### A comparação é feita em minutos

`atrasoMinutos > LIMIAR_ATRASO_HORAS * 60`. Se a comparação fosse em horas
inteiras, um atraso de 4 h 30 seria truncado para 4 e o passageiro perderia
uma indenização a que tem direito. Os testes cobrem os dois lados da borda
(4 h 05 indeniza, 4 h 00 não).

## A janela de embarque

Assim que o oráculo apura um voo, o contrato passa a recusar novos bilhetes —
o que é correto: não se vende seguro para um voo que já pousou.

Isso cria um detalhe operacional: se o oráculo apurasse imediatamente, a
companhia não conseguiria embarcar o segundo passageiro de um voo. Por isso o
oráculo só apura voos cujo último bilhete foi registrado há mais de
`JANELA_EMBARQUE_SEGUNDOS` (15 s por padrão).

O relógio de referência é o do sistema, e não o do último bloco: a rede local
só avança `block.timestamp` quando mina, então uma rede parada deixaria a
janela aberta para sempre.

## Logs

Toda movimentação vira log, no terminal e em `logs/blockchain.log`.

O `backend/src/log/observador.js` não registra o que o backend *pediu*, e sim
o que a cadeia *executou*: ele lê os logs do contrato bloco a bloco. A
diferença importa porque o oráculo roda em outro fluxo e o contrato dispara
vários pagamentos dentro de uma única transação — nada disso apareceria se o
log fosse escrito no ponto de chamada.

No arranque, o histórico é apenas indexado, sem reimprimir: reiniciar o
backend não duplica o arquivo de log.

## Escolha da rede

A proposta indica uma rede permissionada — a Rede Blockchain Brasil (RBB) —
priorizando segurança e escalabilidade sobre descentralização total, com custo
de transação zero ou previsível.

Este protótipo roda na Hardhat Network local. O que muda em uma RBB é o
endpoint e a governança dos nós; o contrato, os papéis e o fluxo são os
mesmos. O TJPB, que aqui é uma conta com acesso de leitura, lá seria um nó
validador de fato.

## Limitações conhecidas

- **Vínculo CPF ↔ carteira.** Quem afirma que um CPF é seu é o próprio
  cadastro; o contrato aceita o primeiro vínculo e o torna imutável. Em
  produção isso exigiria integração com gov.br ou validação documental.
- **Oráculo único.** Uma só conta reporta o horário. Em produção seriam várias
  fontes com quórum, para que a falha ou a captura de uma delas não decida
  sozinha o pagamento.
- **Base de voos mockada.** `oracle/voos.mock.js` substitui a integração real
  com ANAC/FlightStats.
- **Companhia única no protótipo.** O contrato já suporta várias companhias
  (usa `msg.sender`), mas o backend opera com uma só carteira.
- **Conversão R$/ETH fixa.** 1 ETH = R$ 1.000, só para exibir reais na
  interface. Não há câmbio nem stablecoin.
- **Sem autenticação nas telas.** Qualquer pessoa escolhe o perfil de
  companhia ou TJPB. Em produção, cada perfil exigiria autenticação
  institucional.
