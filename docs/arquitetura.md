# Fluxo da função central (diagrama de sequência)

Este arquivo documenta, passo a passo, a execução da função central do
protótipo: o registro do atraso e a quitação automática. 

```mermaid
sequenceDiagram
    actor Passageiro
    participant Frontend
    participant Backend
    participant Oracle as Oracle (oracle.js)
    participant Mock as Banco mockado
    participant Contrato as SeguroParametrico
    actor Companhia

    Companhia->>Frontend: acessa a interface e consulta saldo
    Frontend->>Contrato: consultarSaldo(empresa)
    Contrato-->>Frontend: saldo atual
    Companhia->>Contrato: depositarFundo() %% transação assinada pela companhia
    Companhia->>Contrato: cadastrarVoo(vooId, horarioPartida, horarioChegada) %% transação assinada pela companhia

    Passageiro->>Frontend: consulta o voo e conecta carteira
    Passageiro->>Contrato: inscreverNoVoo(vooId) %% transação assinada pelo passageiro
    Frontend->>Backend: vooId + endereço do passageiro
    Backend->>Oracle: solicita atraso oficial do voo
    Oracle->>Mock: consulta fonte oficial (representa a API da companhia)
    Mock-->>Oracle: companhia + atrasoHoras oficial
    Oracle-->>Backend: repassa o atraso oficial
    Backend-->>Frontend: entrega o atraso oficial
    Frontend-->>Passageiro: exibe o atraso oficial

    Passageiro->>Frontend: informa o atraso percebido e confirma a solicitação
    Passageiro->>Contrato: registrarAtraso(vooId, atrasoHorasInformado, atrasoHorasOficial) %% transação assinada pelo passageiro; oficial vem do Oracle

    Contrato->>Contrato: calcularMulta(atrasoHorasOficial)
    alt atraso acima de 2h e fundo suficiente
        Contrato->>Passageiro: transfere 0,01 ETH
        Contrato-->>Passageiro: PagamentoRealizado + QuitacaoEmitida
    else fundo insuficiente ou atraso dentro do limite
        Contrato-->>Passageiro: registra atraso sem transferir (evento de motivo)
    end
    Contrato-->>Frontend: eventos e estado atual (via indexação/off-chain)
```

## Fluxo

1. A companhia consulta seu saldo pela interface e deposita o fundo de
   garantia diretamente no contrato (`depositarFundo()` é uma transação
   assinada pela própria carteira dela, sem passar pelo backend).
2. Ainda com a própria carteira, a companhia cadastra o voo chamando
   `cadastrarVoo(vooId, horarioPartida, horarioChegada)` — o contrato usa
   `msg.sender` como endereço da empresa, então não é preciso (nem possível)
   informar a companhia como parâmetro, e a companhia não indica passageiros.
3. O passageiro consulta o voo e conecta sua carteira no frontend, e se
   inscreve por conta própria chamando `inscreverNoVoo(vooId)` — um mesmo
   voo pode ter vários passageiros inscritos, cada um com seu próprio estado
   de indenização.
4. O backend não consulta o banco mockado diretamente: ele repassa o pedido
   ao Oracle, que é quem consulta a fonte oficial (o banco mockado,
   representando a API da companhia) e retorna o atraso oficial. O Oracle é
   puramente um componente de consulta/integração off-chain — ele não possui
   privilégios no contrato, não assina transações e não chama `cadastrarVoo`,
   `inscreverNoVoo` nem `registrarAtraso`.
5. O backend entrega o atraso oficial ao frontend, que o exibe ao passageiro.
6. O passageiro informa quantas horas acha que o voo atrasou (valor apenas
   registrado, sem efeito no pagamento) e, ao confirmar, assina com a própria
   carteira a transação
   `registrarAtraso(vooId, atrasoHorasInformado, atrasoHorasOficial)`, usando
   o atraso oficial obtido pelo Oracle para o cálculo da indenização.
7. O contrato calcula a multa internamente sobre o atraso oficial. Dependendo do resultado, a
   execução segue por um dos dois ramos do `alt`:
   - **atraso acima de 2h e fundo suficiente:** o contrato transfere a
     indenização ao passageiro e emite `PagamentoRealizado` e
     `QuitacaoEmitida`;
   - **fundo insuficiente ou atraso dentro do limite:** o atraso já ficou
     registrado, mas nenhuma transferência ocorre — a própria chamada
     retorna uma mensagem explicando o motivo.
8. O resultado (eventos e estado atualizado) pode ser lido por qualquer
   componente off-chain. As transações assinadas pelas carteiras da
   companhia e do passageiro produzem hashes que as interfaces/backends
   podem indexar e apresentar ao usuário.

