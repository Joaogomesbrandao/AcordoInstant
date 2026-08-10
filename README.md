# AcordoInstant

Protótipo de seguro paramétrico para atraso de voos: a companhia deposita um
fundo de garantia no contrato, cadastra o voo (número e horários de partida
e chegada) e inscreve os passageiros nele pelo nome, tudo com sua própria
carteira (o próprio passageiro também pode se inscrever por conta própria
com `inscreverNoVoo`, se preferir). Quando há atraso, o passageiro confere o
valor oficial (consultado pelo Oracle) e, ao confirmar, registra esse atraso
no contrato com sua própria carteira. O contrato calcula a indenização e paga
o passageiro automaticamente quando as condições são satisfeitas, emitindo o
evento de quitação.

## Conteúdo

- `contracts/SeguroParametrico.sol`: único smart contract do projeto.
  Funções centrais: `cadastrarVoo` e `inscreverPassageiroPelaEmpresa` (chamadas
  pela companhia, essa última inscreve um passageiro pelo endereço dele),
  `inscreverNoVoo` (autoinscrição, chamada pelo próprio passageiro) e
  `registrarAtraso` (chamada pelo passageiro), que calcula a multa e paga o
  passageiro se houver saldo, com `depositarFundo` como função de apoio ao
  fluxo.
- `oracle/oracle.js`: componente off-chain de consulta/integração — busca o
  atraso oficial na fonte de dados do voo e o repassa ao backend. Não possui
  privilégios no contrato e não assina nenhuma transação.
- `docs/diagrama-arquitetura-base.md`: diagrama de arquitetura (componentes,
  o que fica on-chain e o que fica off-chain).
- `docs/arquitetura.md`: diagrama de sequência do fluxo da função central.
- `docs/diagrama-classes.md`: diagrama de classes do contrato — atributos,
  funções e relações.
- `frontend/`: interface web em React + TypeScript para interagir com o contrato.

## Fluxo do Oracle (consulta off-chain)

O Oracle não participa das transações on-chain. Ele apenas consulta o banco
mockado (que representa a fonte/API oficial da companhia) e repassa o atraso
oficial ao backend, que o entrega ao frontend para exibição ao passageiro.
Somente depois de conferir esse valor o passageiro assina, com a própria
carteira, a transação
`registrarAtraso(vooId, atrasoHorasInformado, atrasoHorasOficial)` — o
segundo argumento é apenas o valor que o próprio passageiro digitou como
referência (não interfere no pagamento); o terceiro é o valor oficial do
Oracle, usado no cálculo da indenização. A demonstração
abaixo, no Remix, cobre apenas a parte on-chain desse fluxo (as transações
assinadas pela companhia e pelo passageiro); a consulta do atraso oficial
pelo Oracle acontece fora da blockchain e não tem uma tela própria no Remix.

### Rodando o sistema integrado

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

## Demonstração no Remix

1. Acesse [remix.ethereum.org](https://remix.ethereum.org), crie um arquivo `SeguroParametrico.sol` e cole o código do contrato.
2. Vá em **Solidity Compiler**, selecione a versão `0.8.24` e clique em **Compile**.
3. Vá em **Deploy & Run Transactions**, deixe o **Environment** como `Remix VM`. Você terá várias contas de teste com 100 ETH cada — use:
   - **Conta 1** → Companhia aérea
   - **Conta 2** → Passageiro
4. O construtor não recebe argumentos: com qualquer conta selecionada, clique em **Deploy**.
5. **Depósito do escrow:** com a **Conta 1** (Companhia) selecionada, coloque `1` no campo **Value** (unidade `Ether`) e chame `depositarFundo`.
6. **Cadastro do voo:** ainda com a **Conta 1**, coloque **Value = 0** (importante!) e chame `cadastrarVoo(vooId, horarioPartida, horarioChegada)` — os horários são timestamps Unix (segundos) e o contrato usa `msg.sender` (a Conta 1) como endereço da empresa automaticamente.
7. **Inscrição do passageiro:** troque para a **Conta 2** (Passageiro). Com **Value = 0**, chame `inscreverNoVoo(vooId)` para se vincular ao voo cadastrado. Alternativa: a própria companhia (**Conta 1**) pode inscrever o passageiro em seu lugar chamando `inscreverPassageiroPelaEmpresa(vooId, enderecoDaConta2)` — é o que a interface web faz, já que o passageiro não assina transações por lá.
8. **Registro do atraso e pagamento automático:** ainda com a **Conta 2**, chame `registrarAtraso(vooId, atrasoHorasInformado, atrasoHorasOficial)` — use um valor de `atrasoHorasOficial` `> 2` para disparar o pagamento (`atrasoHorasInformado` é livre, fica apenas registrado). Confira no console os eventos `AtrasoRegistrado`, `PagamentoRealizado` e `QuitacaoEmitida`.
9. **Conferir o estado:**
   - `consultarSaldo(enderecoDaCompanhia)` → saldo do escrow da companhia, em wei (ex: `980000000000000000` = `0,98 ETH`).
   - `consultarVoo(vooId)` → mostra o voo, incluindo `totalPassageiros`.
   - `consultarInscricao(vooId, enderecoDoPassageiro)` → mostra `pago: true` para a Conta 2.
   - Saldo da carteira do passageiro (Conta 2) aumenta em `0,01 ETH` — visível no dropdown **Account**.
> ⚠️ **Atenção ao campo Value:** ele só deve ter valor diferente de zero na chamada de `depositarFundo` (a única função `payable`). Nas demais funções, deixe **Value = 0**, senão a transação reverte.
> ⚠️ **Atenção à conta selecionada:** `cadastrarVoo` deve ser chamada pela conta da companhia; `inscreverNoVoo` e `registrarAtraso` pela conta do passageiro — o contrato usa `msg.sender` para validar isso e reverte caso contrário.

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

