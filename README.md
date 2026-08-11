# AcordoInstant

Protótipo de seguro paramétrico para atraso de voos: a companhia deposita um
fundo de garantia no contrato, cadastra o voo (número e horários de partida
e chegada) e inscreve os passageiros nele pelo nome, tudo com a carteira da
companhia operada pelo backend. Quando há atraso, o passageiro confere o valor
oficial e confirma a solicitação. O contrato calcula a indenização e paga
diretamente o endereço do passageiro, emitindo o evento de quitação.

## Conteúdo

- `contracts/SeguroParametrico.sol`: único smart contract do projeto.
  Funções centrais: `cadastrarVoo` e `inscreverPassageiroPelaEmpresa`
  (chamadas pela companhia, essa última inscreve um passageiro pelo endereço
  dele) e `registrarAtrasoPelaEmpresa`, que calcula a multa sobre o atraso
  oficial e paga o passageiro se houver saldo, com `depositarFundo` como
  função de apoio ao fluxo. `inscreverNoVoo` continua disponível para o
  cenário em que o passageiro tenha carteira própria e queira se inscrever
  sozinho.
- `oracle/oracle.js`: componente off-chain de consulta/integração — busca o
  atraso oficial na fonte de dados do voo e o repassa ao backend. Não possui
  privilégios no contrato e não assina nenhuma transação.
- `hardhat.config.js`, `scripts/deploy.js` e `test/`: compilação, implantação
  e testes do contrato com Hardhat.
- `deployments/`: registro das implantações (endereço do contrato, rede,
  chainId, bloco e hash da transação).
- `docs/deploy.md`: como compilar, testar e implantar o contrato na rede de
  testes, com o endereço implantado documentado.
- `docs/guia-teste-manual.md`: roteiro de teste da interface do zero — de onde
  vêm os endereços e as chaves, o passo a passo dos dois painéis e as
  armadilhas conhecidas.
- `docs/diagrama-arquitetura-base.md`: diagrama de arquitetura (componentes,
  o que fica on-chain e o que fica off-chain).
- `docs/arquitetura.md`: diagrama de sequência do fluxo da função central.
- `docs/diagrama-classes.md`: diagrama de classes do contrato — atributos,
  funções e relações.
- `docs/backend-integracao.md`: rotas do backend e detalhes da integração
  on-chain.
- `frontend/`: interface web em React + TypeScript para interagir com o contrato.

## Smart contract e rede de testes

| Item | Valor |
|---|---|
| Ferramentas | Solidity 0.8.24 + Hardhat 3 |
| Rede | Hardhat Network local (`npx hardhat node`), chainId `31337` |
| Endereço implantado | `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Testes | `npm test` — 21 testes |

```bash
npm run chain          # 1. sobe a rede de testes local (deixe rodando)
npm run compile        # 2. compila o contrato
npm test               # 3. roda os testes
npm run deploy:local   # 4. implanta e imprime o endereço
npm run smoke:onchain  # 5. fluxo ponta a ponta contra o contrato implantado
```

O passo a passo completo, incluindo o deploy opcional na Sepolia, está em
[`docs/deploy.md`](docs/deploy.md). Para testar a aplicação pela interface —
de onde vêm os endereços do passageiro e da companhia até conferir o pagamento
on-chain —, siga [`docs/guia-teste-manual.md`](docs/guia-teste-manual.md).

## Fluxo do Oracle (consulta off-chain)

O Oracle não participa das transações on-chain. Ele apenas consulta o banco
mockado (que representa a fonte/API oficial da companhia) e repassa o atraso
oficial ao backend, que o entrega ao frontend para exibição ao passageiro.
Somente depois de conferir esse valor o passageiro confirma a solicitação. O
backend consulta novamente o Oracle e assina
`registrarAtrasoPelaEmpresa(vooId, enderecoPassageiro, atrasoHorasInformado, atrasoHorasOficial)`.
O passageiro não precisa de chave privada. A consulta do atraso oficial pelo
Oracle acontece fora da blockchain.

### Rodando o sistema integrado

0. Antes de tudo, suba a rede de testes e implante o contrato (veja
   [`docs/deploy.md`](docs/deploy.md)): `npm run chain` em um terminal e
   `npm run deploy:local` em outro. Sem o contrato implantado e sem os `.env`
   configurados, a interface abre normalmente, mas as ações da companhia
   respondem `503` e as consultas do passageiro falham.
1. Na raiz do projeto, instale as dependências do backend:
   `npm install`
2. Instale as dependências do frontend:
   `npm --prefix frontend install`
3. **Para rodar o projeto completo em desenvolvimento (o jeito recomendado),
   use `npm run dev` na raiz.** Esse comando sobe as duas partes juntas:
   - backend em `http://127.0.0.1:3001`;
   - frontend (Vite, com hot reload) em `http://localhost:3000` — é essa a
     URL que você deve abrir no navegador.

   O Vite já encaminha automaticamente as chamadas de `/api`, `/voos`,
   `/companhia` e `/health` para o backend, então não é preciso configurar
   CORS nem `VITE_API_URL` nesse modo.

   `npm start` **sozinho só sobe o backend** (`node backend/server.js`), sem
   o Vite — use-o apenas junto com o passo 4 abaixo, para o modo de
   aplicação única.
4. Alternativa: para servir tudo a partir de um único processo (sem hot
   reload, mais parecido com produção), gere a build com `npm run build` e
   depois execute `npm start`. Nesse modo o backend também serve o
   `frontend/dist` já compilado, tudo em `http://127.0.0.1:3001`.
5. **O banco de dados (`data/store.json`) é zerado automaticamente toda vez**
   que você roda `npm run dev` ou `npm start` (hooks `predev`/`prestart`
   chamam `scripts/reset-db.js`), então cada execução começa sem nenhuma
   companhia, passageiro ou apólice cadastrados. Para zerar manualmente sem
   reiniciar nada, rode `npm run reset:db`.
6. Semeie o atraso oficial de um voo usando o Oracle:
   `node oracle/oracle.js --flight 1234 --delay 240` (delay em minutos; 240 = 4h).
7. No painel do passageiro (passo 5 da seção **Como usar a interface**,
   abaixo), o botão "Buscar atraso oficial" chama
   `POST /voos/:vooId/consultar` no backend, que devolve o `atrasoHorasOficial`
   já semeado. Se o backend rodar em outro host/porta, aponte o frontend para
   ele com `VITE_API_URL` (só necessário fora do modo `npm run dev`).

### Implementação do backend e integração on-chain

O passageiro não possui chave privada e nunca assina transações. O endereço
informado no cadastro é usado somente como beneficiário do pagamento.

1. `oracle/oracle.js` grava o status oficial e o atraso em minutos no banco
   mockado via `POST /api/internal/flight-status`; o registro recebe um
   `proofHash` SHA-256 para rastreabilidade off-chain.
2. As rotas `/companhia/*` são assinadas pelo backend usando
   `OPERATOR_PRIVATE_KEY` para depósito, resgate, cadastro de voo e inscrição.
3. `POST /voos/:vooId/consultar` lê o status do Oracle e converte minutos para
   horas inteiras para exibição.
4. `POST /voos/:vooId/registrar-atraso` consulta novamente o Oracle, ignora
   qualquer atraso oficial enviado pelo cliente e chama
   `registrarAtrasoPelaEmpresa` no contrato.
5. O contrato valida a companhia, a inscrição, o limite e o saldo; depois
   transfere o valor diretamente para a carteira do passageiro e emite
   `AtrasoRegistrado`, `PagamentoRealizado` e `QuitacaoEmitida`. Quando não há
   direito ao pagamento (atraso dentro do limite ou fundo insuficiente), emite
   `AtrasoRegistrado` e `PagamentoNaoRealizado` com o motivo — é dele que sai a
   mensagem exibida na interface.

Não existe função pública em que o próprio passageiro informe o atraso oficial:
ela permitiria a qualquer endereço inscrito declarar um atraso inventado e
sacar o fundo da companhia. O atraso oficial só entra no contrato pela
transação assinada pela companhia, com o valor relido do Oracle na hora do
registro.

#### Configuração da rede

Crie um `.env` na raiz a partir de `.env.example`, sem versionar a chave
privada:

```env
RPC_URL=http://127.0.0.1:8545
CHAIN_ID=31337
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
OPERATOR_PRIVATE_KEY=0x...
```

O `CONTRACT_ADDRESS` é o endereço impresso por `npm run deploy:local` (também
gravado em `deployments/localhost.json`). Na rede local, use como
`OPERATOR_PRIVATE_KEY` a chave da **Account #0** impressa por `npm run chain`
— ela representa a companhia aérea e já tem saldo para gás. O backend assina
somente pela companhia; ele não controla carteiras de passageiros.

Em `frontend/.env`, configure `VITE_RPC_URL` e `VITE_CONTRACT_ADDRESS` com os
mesmos valores (são usados apenas nas leituras diretas do contrato).

Para conferir que os ABIs mantidos à mão continuam batendo com o contrato
compilado, rode `npm run check:abi`.

## Demonstração no Remix

1. Acesse [remix.ethereum.org](https://remix.ethereum.org), crie um arquivo `SeguroParametrico.sol` e cole o código do contrato.
2. Vá em **Solidity Compiler**, selecione a versão `0.8.24` e clique em **Compile**.
3. Vá em **Deploy & Run Transactions**, deixe o **Environment** como `Remix VM`. Você terá várias contas de teste com 100 ETH cada — use:
   - **Conta 1** → Companhia aérea
   - **Conta 2** → Passageiro
4. O construtor não recebe argumentos: com qualquer conta selecionada, clique em **Deploy**.
5. **Depósito do escrow:** com a **Conta 1** (Companhia) selecionada, coloque `1` no campo **Value** (unidade `Ether`) e chame `depositarFundo`.
6. **Cadastro do voo:** ainda com a **Conta 1**, coloque **Value = 0** (importante!) e chame `cadastrarVoo(vooId, horarioPartida, horarioChegada)` — os horários são timestamps Unix (segundos) e o contrato usa `msg.sender` (a Conta 1) como endereço da empresa automaticamente.
7. **Inscrição do passageiro:** ainda com a **Conta 1** (Companhia), chame `inscreverPassageiroPelaEmpresa(vooId, enderecoDaConta2)` — é o que a interface web faz, já que o passageiro não assina transações por lá. Alternativa: trocando para a **Conta 2**, o próprio passageiro pode se inscrever com `inscreverNoVoo(vooId)`.
8. **Registro do atraso e pagamento automático:** com a **Conta 1** (só a companhia dona do voo pode chamar), execute `registrarAtrasoPelaEmpresa(vooId, enderecoDaConta2, atrasoHorasInformado, atrasoHorasOficial)` — use um valor de `atrasoHorasOficial` `> 2` para disparar o pagamento (`atrasoHorasInformado` é livre, fica apenas registrado). Confira no console os eventos `AtrasoRegistrado`, `PagamentoRealizado` e `QuitacaoEmitida`. Com `atrasoHorasOficial <= 2`, ou sem fundo suficiente, aparece `PagamentoNaoRealizado` com o motivo.
9. **Conferir o estado:**
   - `consultarSaldo(enderecoDaCompanhia)` → saldo do escrow da companhia, em wei (ex: `980000000000000000` = `0,98 ETH`).
   - `consultarVoo(vooId)` → mostra o voo, incluindo `totalPassageiros`.
   - `consultarInscricao(vooId, enderecoDoPassageiro)` → mostra `registrado: true` e `pago: true` para a Conta 2.
   - Saldo da carteira do passageiro (Conta 2) aumenta em `0,01 ETH` — visível no dropdown **Account**.
> ⚠️ **Atenção ao campo Value:** ele só deve ter valor diferente de zero na chamada de `depositarFundo` (a única função `payable`). Nas demais funções, deixe **Value = 0**, senão a transação reverte.
> ⚠️ **Atenção à conta selecionada:** `cadastrarVoo`, `inscreverPassageiroPelaEmpresa` e `registrarAtrasoPelaEmpresa` devem ser chamadas pela conta da companhia; `inscreverNoVoo`, pela conta do passageiro — o contrato usa `msg.sender` para validar isso e reverte caso contrário.

## Regra paramétrica atual

- atraso de até duas horas: nenhuma indenização;
- atraso superior a duas horas: pagamento fixo de `0,01 ETH`;
- saldo insuficiente: atraso registrado, sem pagamento; uma nova tentativa
  pode ser feita após a companhia depositar fundos.

ETH é usado apenas como unidade de demonstração.

## Frontend (React + TypeScript)

O projeto possui uma interface web local em `frontend/` para interagir com o contrato de forma visual.

### Executar só o frontend

1. Abra um terminal na pasta `frontend`:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Acesse no navegador: **http://localhost:3000/**

Se o backend estiver rodando na configuração padrão (`http://127.0.0.1:3001`),
o Vite já encaminha automaticamente as chamadas de API. `VITE_API_URL` só é
necessário quando a API estiver em outro host ou porta.

### Como usar a interface

Não é preciso ter a MetaMask ou qualquer extensão instalada. A companhia
aérea é única, fixa e configurada automaticamente pelo backend (a chave dela
fica só no servidor); o passageiro só precisa de um nome e de um endereço de
carteira (pode ser só digitado, não precisa controlar a chave privada dele).

1. **Login:** na tela inicial, escolha um perfil: **Sou uma companhia
   aérea** ou **Sou passageiro**.
2. **Companhia aérea:** entra direto no painel, sem nenhum cadastro — dá
   para depositar/resgatar o fundo de garantia, cadastrar voos (número +
   horários de partida e chegada) e inscrever um passageiro já cadastrado
   (escolhido por nome em uma lista) em um dos voos dela.
3. **Passageiro (primeiro acesso):** é pedido um nome e o endereço da
   carteira (formato `0x` + 40 caracteres hexadecimais). Isso cadastra o
   passageiro no backend; se o mesmo endereço já existir, ele é reaproveitado
   em vez de dar erro. Depois de cadastrado, é a companhia quem o inscreve
   nos voos (pelo nome, no painel dela).
4. **Trocar usuário:** o botão **Trocar usuário**, no topo, limpa a
   identidade atual e volta para a tela de cadastro, permitindo entrar com
   outro nome/endereço.
5. **Painel do passageiro:** consultar um voo pelo número para ver se já foi
   inscrito nele pela companhia, acompanhar os voos em que está inscrito e,
   para os que tiverem atraso, buscar o valor oficial junto ao Oracle e
   confirmar o registro que dispara o pagamento automático.
6. **Sair:** encerra a sessão e volta para a tela de login (não apaga o
   cadastro do passageiro, só a sessão local).

> As leituras do contrato (consultar voo, calcular multa etc.) usam RPC
> direto e dependem de `VITE_CONTRACT_ADDRESS`/`VITE_RPC_URL` estarem
> configurados (veja `frontend/.env.example`). Sem isso, a navegação e o
> cadastro continuam funcionando normalmente, só as consultas ao contrato
> falham.

### Estrutura do frontend

- `src/App.tsx`: orquestra o login, a identidade do passageiro e qual painel
  exibir.
- `src/config.ts`: configuração fixa (URL do backend, RPC e endereço do
  contrato para leituras diretas).
- `src/api.ts`: chamadas ao backend (cadastro de passageiro, ações da
  companhia e do passageiro que exigem assinatura).
- `src/hooks/usePassengerIdentity.ts`: identidade do passageiro (nome +
  endereço) persistida no `localStorage`, cadastrada via backend.
- `src/components/LoginScreen.tsx`: tela inicial de escolha de perfil.
- `src/components/PassengerRegisterGate.tsx`: cadastro do passageiro
  (nome + endereço da carteira).
- `src/components/TopBar.tsx`: cabeçalho fixo com as abas Companhia/
  Passageiro, a identidade ativa e os botões de trocar usuário/sair.
- `src/components/AirlinePanel.tsx`: fundo de garantia, cadastro e listagem
  de voos da companhia e inscrição de passageiros (por nome) nos voos dela
  (tudo via backend).
- `src/components/PassengerPanel.tsx`: consulta de voos, listagem dos voos
  em que o passageiro foi inscrito e fluxo de indenização.
- `src/utils/address.ts`: validação e formatação de endereços.
- `src/contract.ts`: ABI do `SeguroParametrico.sol`.
- Cada componente possui seu próprio arquivo `.css` para personalização visual.

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
