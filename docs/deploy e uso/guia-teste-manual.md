# Guia de teste manual da interface

Roteiro para testar o AcordoInstant do zero pela interface web, incluindo de
onde vêm os endereços e as chaves usadas na demonstração. A implantação do
contrato está descrita em [`deploy.md`](./deploy.md).

## De onde vêm as credenciais

| Ator | O que precisa | Onde aparece na interface |
|---|---|---|
| **Companhia aérea** | Uma chave privada, que fica **só no `.env`** (`OPERATOR_PRIVATE_KEY`) | Nenhum campo. O topo mostra "Companhia automática" — o backend assina tudo por ela |
| **Passageiro** | **Só um nome e um endereço `0x…`**, sem chave privada | Tela "Quem é você?" ao entrar como passageiro |

O endereço do passageiro serve exclusivamente para **receber** o ETH da
indenização, então qualquer endereço válido funciona — ninguém precisa assinar
nada por ele.

## Onde pegar os endereços

`npm run chain` imprime 20 contas com 10.000 ETH cada e as respectivas chaves
privadas:

```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266   ← companhia (chave já está no .env)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8   ← use como passageiro
Account #2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC   ← outro passageiro
Account #3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
```

A Account #0 é a companhia porque a chave privada dela é exatamente o
`OPERATOR_PRIVATE_KEY` configurado no `.env`. Para os passageiros, **use as
Accounts #1 em diante**: como já existem no nó com saldo, dá para ver o valor
subir de `10000` para `10000.01` ETH quando a indenização cai.

> As chaves impressas pelo `npm run chain` são públicas e conhecidas. Use
> somente na rede local, nunca em uma rede pública.

Se preferir um endereço novo em vez de reaproveitar uma conta do nó:

```bash
node -e 'import("ethers").then(({Wallet})=>console.log(Wallet.createRandom().address))'
```

Funciona igual — começa com saldo 0 e fica com 0,01 ETH depois do pagamento.

## Preparação

**Terminal 1 — rede de testes** (deixe aberto)

```bash
npm run chain
```

**Terminal 2 — deploy** (na primeira vez, e sempre que o Terminal 1 for
reiniciado)

```bash
npm run deploy:local
```

O `.env` (raiz) e o `frontend/.env` já apontam para o endereço que ele devolve
(`0x5FbDB2315678afecb367f032d93F642f64180aa3`), que é sempre o mesmo.

**Terminal 2 — aplicação**

```bash
npm run dev
```

Abra **http://localhost:3000**.

## Passo a passo

### 1. Cadastre o passageiro primeiro

A ordem importa: a companhia escolhe o passageiro **por nome, em uma lista**,
então ele precisa existir antes.

1. Na tela inicial, clique em **"Sou passageiro"**.
2. Em "Quem é você?", preencha:
   - Nome: `Maria`
   - Endereço da Carteira Blockchain: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (Account #1)
3. **Continuar**.

### 2. Monte o voo pelo painel da companhia

Clique na aba **Companhia** no topo — não precisa sair nem fazer login de novo.

1. **Fundo de garantia** → Depositar (ETH): `0.05` → **Depositar**. Clique em
   **Atualizar saldo**: deve mostrar `0.05 ETH`.
2. **Cadastrar voo**:
   - Número do voo: `1234` (precisa ser inteiro positivo — é o `vooId` no contrato);
   - Horário de partida e de chegada: qualquer data, com a **chegada depois da
     partida** (o contrato reverte se não for);
   - **Cadastrar voo**.
3. **Inscrever passageiro em um voo**: escolha `Maria` na lista, número do voo
   `1234` → **Inscrever passageiro**.
4. **Meus voos** → **Carregar voos**: o voo 1234 aparece com "1 passageiro".
   Esses dados vêm direto do contrato.

### 3. Semeie o atraso oficial no Oracle

Em um terceiro terminal (com o backend rodando):

```bash
node oracle/oracle.js --flight 1234 --delay 240
```

`--delay` é em **minutos**: 240 = 4 horas. O número depois de `--flight` tem
que ser **igual ao número do voo** cadastrado.

### 4. Receba a indenização pelo painel do passageiro

Clique na aba **Passageiro**.

1. **Passo 1 — Consultar um voo**: digite `1234` → **Consultar**. Deve dizer
   "Você já está inscrito neste voo".
2. **Passo 2 — Meus voos** → **Carregar meus voos**: o voo 1234 aparece com o
   botão **Indicar atraso**.
3. **Passo 3**: número do voo `1234`, "Quantas horas você acha que atrasou?"
   `3` (esse número é só registro, não afeta o cálculo) → **Buscar atraso
   oficial**. Aparece a caixa: *Atraso oficial (Oracle): 4 horas · Indenização
   estimada: 0.01 ETH*.
4. **Confirmar e registrar atraso** → a mensagem no rodapé mostra "Atraso do
   voo 1234 registrado. Pagamento realizado."
5. **Passo 4 — Minhas indenizações solicitadas**: o voo aparece com o selo
   **Pago**.

### 5. Confirme que o ETH saiu do escrow e chegou ao passageiro

```bash
node -e 'const a=process.argv[1];fetch("http://127.0.0.1:8545",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",method:"eth_getBalance",params:[a,"latest"],id:1})}).then(r=>r.json()).then(j=>console.log(a,"=",Number(BigInt(j.result))/1e18,"ETH"))' 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
```

Deve imprimir `10000.01 ETH`. E na aba Companhia, **Atualizar saldo** cai de
`0.05` para `0.04`.

## Cenários negativos (valem a pena na demonstração)

**Atraso dentro do limite.** Repita o roteiro com outro voo (`5678`) e
`--delay 90` (1h30). O resultado é "Atraso abaixo do limite de indenizacao", o
selo fica **Sem direito a indenização** e nenhum ETH se move. Esse texto vem do
próprio contrato, do evento `PagamentoNaoRealizado`.

**Companhia sem fundo.** Resgate o fundo antes (Resgatar `0.04`) e registre um
atraso de 4h: o selo fica **Aguardando saldo da companhia** e o botão **Tentar
pagamento novamente** passa a funcionar depois de um novo depósito.

## Armadilhas conhecidas

1. **O banco zera a cada `npm run dev`**, mas o navegador guarda o passageiro
   no `localStorage`. Sintoma: você continua "logado" como Maria, mas ela sumiu
   da lista da companhia. Solução: **Trocar usuário** e cadastrar de novo (o
   mesmo endereço é reaproveitado, não dá erro).
2. **Reiniciar o `npm run chain` apaga voos, inscrições e o fundo** — a Hardhat
   Network não grava em disco. O endereço do contrato continua o mesmo depois
   de `npm run deploy:local`, então os `.env` não mudam, mas o cenário precisa
   ser remontado do zero.
3. **A ordem importa**: passageiro cadastrado → voo cadastrado → passageiro
   inscrito. Inscrever em um voo inexistente dá erro.
4. **O número do voo tem que ser o mesmo** no cadastro da companhia e no
   `--flight` do Oracle. Sem o Oracle semeado, "Buscar atraso oficial" responde
   que não há status para o voo.
5. **Só atraso acima de 2 horas paga** — 2h exatas não pagam, e os minutos
   quebrados são descartados (`150 min` vira `2h`, e não paga).
6. **Criou ou alterou o `frontend/.env` com o Vite já rodando?** Reinicie o
   `npm run dev`: o Vite só lê o `.env` na inicialização, e sem ele as consultas
   do passageiro falham.
7. **`EADDRINUSE: address already in use 127.0.0.1:8545`** ao rodar
   `npm run chain`: já existe um `hardhat node` rodando (normalmente esquecido
   de uma execução anterior). Descubra e encerre o processo:

   ```bash
   ss -ltnp | grep 8545     # mostra o PID que está segurando a porta
   kill <PID>
   ```
