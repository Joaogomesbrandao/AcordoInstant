# Deploy e execução

Rede local, sem nenhuma configuração manual. O script de implantação deriva
as carteiras, publica o contrato e grava as configurações que o backend e o
frontend consomem.

## Pré-requisitos

Node.js 22+ e as dependências instaladas:

```bash
npm install
npm --prefix frontend install
```

## Passo a passo

### 1. Subir a rede local

```bash
npm run chain
```

Deixe rodando. Sobe a Hardhat Network em `127.0.0.1:8545` (chainId `31337`) e
grava a saída em `logs/hardhat-node.log`.

### 2. Compilar e implantar

Em outro terminal:

```bash
npm run compile
npm run deploy
```

A saída lista as carteiras derivadas e o endereço do contrato:

```
── AcordoInstant · implantacao ───────────────────────────────────
   rede localhost (chainId 31337) · seguro parametrico de atraso de voo

  Carteiras institucionais
    #0 Companhia aerea  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266  10.000 ETH
    #1 Oraculo          0x70997970C51812dc3A010C7d01b50e0d17dc79C8  10.000 ETH
    #2 TJPB             0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC  10.000 ETH
    #3 Plataforma       0x90F79bf6EB2c4f870365E785982E1f101E93b906  10.000 ETH

  Carteiras de teste dos passageiros (nenhuma cadastrada no sistema)
    #4 Usuario de teste 1  0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
    ...

16:56:34  CONTRATO IMPLANTADO   SeguroVoo em 0x5FbDB2315678afecb367f032d93F642f64180aa3
                                tx 0x8e20…237a · bloco 1 · gas 2.086.781
16:56:34  REGRA REGISTRADA      atraso acima de 4h ⇒ R$ 500,00 por passageiro
```

O script grava dois arquivos:

| Arquivo | Consumido por |
|---|---|
| `deployments/localhost.json` | Backend e oráculo (endereço do contrato e papéis) |
| `frontend/src/rede.config.ts` | Frontend (endereço e chainId para exibição) |

**Não é preciso copiar endereço para nenhum `.env`.** Implantar de novo
reconfigura as duas pontas.

### 3. Subir a aplicação

```bash
npm run dev
```

Backend em `http://127.0.0.1:3001` e frontend em `http://localhost:3000` — é
essa a URL para abrir no navegador. O oráculo sobe junto com o backend e
começa a apurar voos sozinho.

### 4. (Opcional) Popular com dados de demonstração

```bash
npm run seed
```

Embarca passageiros em voos com os três desfechos e **não** cadastra nenhum
cliente — deixando o cenário mais interessante montado: indenizações retidas
esperando alguém se cadastrar. Os CPFs usados são impressos ao final.

## De onde vêm as carteiras

Todas são derivadas do mnemônico padrão do Hardhat
(`test test … junk`), nos índices fixos definidos em `deploy/contas.js`:

| Índice | Papel |
|---|---|
| #0 | Companhia aérea |
| #1 | Oráculo |
| #2 | TJPB (nó validador) |
| #3 | Plataforma |
| #4 – #8 | Cinco carteiras de teste de passageiros |

Ninguém precisa copiar chave privada: deploy, backend, oráculo e testes
derivam as mesmas contas. As cinco carteiras de passageiro são apenas
geradas — nenhum usuário nasce cadastrado no sistema.

> Esse mnemônico é público e conhecido. Vale só para a rede local
> descartável; nunca reaproveitar em rede pública.

## Modo processo único

Para servir tudo a partir do backend, sem o Vite:

```bash
npm run build
npm start
```

O backend passa a servir `frontend/dist` em `http://127.0.0.1:3001`.

## Logs

| Arquivo | Conteúdo |
|---|---|
| `logs/blockchain.log` | Toda movimentação do contrato, lida da cadeia |
| `logs/deploy.log` | Implantação e dados de demonstração |
| `logs/hardhat-node.log` | Saída bruta do nó |

Para acompanhar em tempo real:

```bash
npm run logs
```

## Recomeçar do zero

```bash
npm run reset
```

Zera clientes, manifesto e logs. Para zerar também a blockchain, reinicie o
`npm run chain` (a Hardhat Network não persiste em disco) e rode
`npm run deploy` de novo.

## Configuração opcional

Tudo funciona sem `.env`. Se precisar ajustar algo, copie `.env.example`:

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3001` | Porta do backend |
| `INTERVALO_ORACULO_SEGUNDOS` | `8` | Frequência de apuração |
| `JANELA_EMBARQUE_SEGUNDOS` | `15` | Tempo para embarcar mais passageiros |
| `CPF_PEPPER` | valor de demonstração | Segredo do hash do CPF |
| `MNEMONIC` | mnemônico do Hardhat | Origem das carteiras |

## Testes

```bash
npm test
```

30 testes cobrindo os termos do contrato, o controle de acesso de cada papel,
as bordas da regra (4 h 05 indeniza, 4 h 00 não), o depósito direto, a
retenção para CPF sem cadastro e a liberação no cadastro.
