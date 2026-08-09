# AcordoInstant

Protótipo de seguro paramétrico para atraso de voos: a companhia deposita um
fundo de garantia no contrato e cadastra o voo (número e horários de partida
e chegada) com sua própria carteira; qualquer passageiro se inscreve nesse
voo por conta própria. Quando há atraso, o passageiro confere o valor oficial
(consultado pelo Oracle) e, ao confirmar, registra esse atraso no contrato
com sua própria carteira. O contrato calcula a indenização e paga o
passageiro automaticamente quando as condições são satisfeitas, emitindo o
evento de quitação.

## Conteúdo

- `contracts/SeguroParametrico.sol`: único smart contract do projeto.
  Funções centrais: `cadastrarVoo` (chamada pela companhia), `inscreverNoVoo`
  e `registrarAtraso` (chamadas pelo passageiro), que calcula a multa e paga
  o passageiro se houver saldo, com `depositarFundo` como função de apoio ao
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

## Demonstração no Remix

1. Acesse [remix.ethereum.org](https://remix.ethereum.org), crie um arquivo `SeguroParametrico.sol` e cole o código do contrato.
2. Vá em **Solidity Compiler**, selecione a versão `0.8.24` e clique em **Compile**.
3. Vá em **Deploy & Run Transactions**, deixe o **Environment** como `Remix VM`. Você terá várias contas de teste com 100 ETH cada — use:
   - **Conta 1** → Companhia aérea
   - **Conta 2** → Passageiro
4. O construtor não recebe argumentos: com qualquer conta selecionada, clique em **Deploy**.
5. **Depósito do escrow:** com a **Conta 1** (Companhia) selecionada, coloque `1` no campo **Value** (unidade `Ether`) e chame `depositarFundo`.
6. **Cadastro do voo:** ainda com a **Conta 1**, coloque **Value = 0** (importante!) e chame `cadastrarVoo(vooId, horarioPartida, horarioChegada)` — os horários são timestamps Unix (segundos) e o contrato usa `msg.sender` (a Conta 1) como endereço da empresa automaticamente.
7. **Inscrição do passageiro:** troque para a **Conta 2** (Passageiro). Com **Value = 0**, chame `inscreverNoVoo(vooId)` para se vincular ao voo cadastrado.
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

### Executar o frontend

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

### Como usar a interface

1. **Deploy do contrato:** siga os passos da seção **Demonstração no Remix** para compilar e publicar o contrato. Anote o endereço do contrato.
2. **Login:** na tela inicial, escolha um perfil (**Companhia aérea** ou **Passageiro**). Abaixo aparecem os dois campos necessários para entrar: o **endereço do contrato** implantado (ex: copiado do Remix) e o **endereço da carteira** desse perfil (ex: uma das contas do Remix). Não é preciso ter a MetaMask instalada — basta digitar os dois endereços e clicar em **Entrar**. Quem tiver a extensão pode, opcionalmente, usar o link "preencher com a MetaMask automaticamente" para preencher o campo da carteira com uma conta real e poder assinar transações de verdade.
3. **Navegação:** depois de logado, o topo mostra as abas **Companhia** e **Passageiro** ao lado do nome do app. Cada aba usa seu próprio endereço — ao clicar na aba que ainda não tem um endereço definido (por exemplo, trocar de Companhia para Passageiro), a interface pede para informar o endereço desse outro perfil antes de mostrar o painel.
4. **Painel da companhia:** depositar/resgatar o fundo de garantia, cadastrar voos (número + horários de partida e chegada) e ver a lista de voos já cadastrados.
5. **Painel do passageiro:** inscrever-se em um voo pelo número, ver os voos em que já está inscrito e, para os que tiverem atraso, buscar o valor oficial junto ao Oracle e confirmar o registro que dispara o pagamento automático.
6. **Trocar de conta ou sair:** o botão **Trocar de conta**, no canto superior direito, reabre o seletor de contas da MetaMask para a aba ativa (só funciona com a extensão instalada); **Sair** encerra a sessão por completo, voltando à tela de login.
7. **Assinar transações de verdade:** como os endereços podem ser só digitados, ações que gravam algo no contrato (depositar, cadastrar voo, inscrever-se, registrar atraso) só funcionam quando o endereço do perfil ativo estiver de fato conectado via MetaMask — a interface avisa quando isso não é o caso. Sem a extensão, dá para navegar e explorar toda a interface, mas quem assina as transações de verdade é o Remix (veja a seção **Demonstração no Remix**).

### Estrutura do frontend

- `src/App.tsx`: orquestra o login, mantém uma carteira independente por papel (companhia/passageiro), o endereço do contrato e qual painel exibir.
- `src/components/LoginScreen.tsx`: tela inicial — escolha do perfil, endereço do contrato e endereço da carteira desse perfil (digitado ou preenchido via MetaMask).
- `src/components/TopBar.tsx`: cabeçalho fixo com as abas Companhia/Passageiro, o endereço do contrato, a carteira ativa e os botões de trocar de conta/sair.
- `src/components/ContractGate.tsx`: tela de segurança para redefinir o endereço do contrato, caso ele seja limpo depois do login.
- `src/components/RoleConnectGate.tsx`: tela exibida ao trocar para uma aba cujo perfil ainda não tem um endereço definido.
- `src/components/AirlinePanel.tsx`: fundo de garantia, cadastro e listagem de voos da companhia.
- `src/components/PassengerPanel.tsx`: inscrição em voos, listagem dos voos do passageiro e fluxo de indenização.
- `src/hooks/useWallet.ts`: mantém o endereço de cada papel (digitável) e, opcionalmente, conecta a MetaMask para anexar um `signer` real (uma instância por papel).
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


