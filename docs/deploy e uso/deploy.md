# Implantação do contrato na rede de testes

Ferramentas usadas, conforme o ambiente recomendado na especificação do
projeto: **Solidity + Hardhat**, com implantação na **Hardhat Network** local
(nó JSON-RPC em `127.0.0.1:8545`).

| Item | Valor |
|---|---|
| Contrato | `contracts/SeguroParametrico.sol` |
| Compilador | `solc` 0.8.24 (otimizador ligado, 200 runs) |
| Framework | Hardhat 3 (`hardhat.config.js`) |
| Rede | Hardhat Network local (`npx hardhat node`), chainId `31337` |
| Endereço implantado | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Conta que assinou o deploy (companhia aérea) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (Account #0) |

O registro completo de cada implantação (endereço, rede, chainId, bloco, hash
da transação e data) fica em `deployments/<rede>.json`, gravado pelo próprio
script de deploy.

> O endereço acima é **determinístico**: um nó Hardhat recém-iniciado sempre
> produz `0x5FbDB231…` no primeiro deploy feito pela Account #0. Reiniciar o nó
> e rodar `npm run deploy:local` de novo devolve o mesmo endereço, então os
> `.env` continuam válidos — o que se perde é o estado (voos, inscrições e
> saldo do escrow), porque a Hardhat Network não persiste dados em disco.

## Passo a passo

Pré-requisitos: Node.js 22+ e `npm install` na raiz e em `frontend/`.

### 1. Subir a rede de testes local

```bash
npm run chain          # npx hardhat node
```

Deixe rodando em um terminal. Ele imprime 20 contas com 10.000 ETH cada e as
respectivas chaves privadas. A **Account #0** é a carteira da companhia aérea
do protótipo.

> As chaves impressas por esse comando são públicas e conhecidas. Use somente
> na rede local, nunca em uma rede pública.

### 2. Compilar e testar

```bash
npm run compile        # npx hardhat compile
npm test               # npx hardhat test  (21 testes)
```

Os testes rodam na Hardhat Network em memória, sem precisar do nó do passo 1.

### 3. Implantar

```bash
npm run deploy:local   # npx hardhat run scripts/deploy.js --network localhost
```

Saída:

```
Rede:      localhost (chainId 31337)
Deployer:  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Saldo:     10000.0 ETH

SeguroParametrico implantado em: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Transacao: 0x17f9…a3eb (bloco 1)
Limiar de atraso: 2 horas
Indenizacao: 0.01 ETH
Registro da implantacao salvo em deployments/localhost.json
```

### 4. Configurar os `.env`

Na raiz (copie de `.env.example`):

```env
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
OPERATOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PORT=3001
```

Em `frontend/.env` (copie de `frontend/.env.example`):

```env
VITE_RPC_URL=http://127.0.0.1:8545
VITE_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

O contrato não tem dono: qualquer conta pode implantá-lo. O que importa é que
`OPERATOR_PRIVATE_KEY` seja **sempre a mesma conta** em todas as ações da
companhia, porque o contrato usa `msg.sender` como dona do voo e do saldo do
escrow. Trocar a chave equivale a trocar de companhia aérea: os voos e o fundo
da anterior ficam inacessíveis.

### 5. Verificar a implantação ponta a ponta

```bash
npm run check:abi      # os ABIs do front e do back batem com o contrato compilado
npm run smoke:onchain  # fluxo completo contra o contrato implantado
```

O `smoke:onchain` sobe o backend em uma porta temporária e percorre o mesmo
caminho da interface: deposita o fundo, cadastra dois voos, inscreve dois
passageiros, semeia o Oracle (4h e 30min de atraso) e confere o resultado
on-chain — saldo do escrow, saldo recebido pelo passageiro e motivo da recusa
quando não há direito à indenização.

### 6. Subir a aplicação

```bash
npm run dev            # backend em :3001 + frontend (Vite) em :3000
```

Para percorrer o fluxo pela interface — onde pegar os endereços do passageiro
e da companhia, em que ordem preencher cada painel e como conferir o pagamento
on-chain —, siga o [guia de teste manual](./guia-teste-manual.md).

## Deploy na Sepolia (opcional)

A configuração já está pronta em `hardhat.config.js`. Falta apenas uma conta
com ETH de faucet:

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/sua_chave
SEPOLIA_PRIVATE_KEY=0x...
```

```bash
npm run deploy:sepolia
```

Depois, aponte `RPC_URL`/`CONTRACT_ADDRESS` (raiz) e
`VITE_RPC_URL`/`VITE_CONTRACT_ADDRESS` (frontend) para a Sepolia e use a mesma
chave em `OPERATOR_PRIVATE_KEY`. O endereço implantado fica registrado em
`deployments/sepolia.json`.

## Arquivos envolvidos

| Arquivo | Papel |
|---|---|
| `hardhat.config.js` | Versão do compilador, otimizador e redes (`hardhat`, `localhost`, `sepolia`). |
| `scripts/deploy.js` | Implanta o contrato, imprime o endereço e grava `deployments/<rede>.json`. |
| `test/SeguroParametrico.test.js` | 21 testes do contrato (escrow, regra paramétrica, quitação e controle de acesso). |
| `scripts/check-abi.js` | Confere os ABIs mantidos à mão (frontend e backend) contra o contrato compilado. |
| `scripts/smoke-onchain.js` | Fluxo ponta a ponta contra o contrato já implantado. |
| `deployments/localhost.json` | Registro da implantação (endereço documentado). |
