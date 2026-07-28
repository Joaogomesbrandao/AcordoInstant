# Fluxo da função central (diagrama de sequência)

Este arquivo documenta, passo a passo, a execução da função central do
protótipo: o registro do atraso e a quitação automática. 

```mermaid
sequenceDiagram
    actor Passageiro
    participant Frontend
    participant Backend
    participant Mock as Banco mockado
    participant Oracle as Oracle (oracle.js)
    participant Contrato as SeguroParametrico
    actor Companhia

    Companhia->>Frontend: acessa a interface e consulta saldo
    Frontend->>Contrato: consultarSaldo(empresa)
    Contrato-->>Frontend: saldo atual
    Companhia->>Contrato: depositarFundo()
    Passageiro->>Frontend: informa voo e conecta carteira
    Frontend->>Backend: vooId + endereço do passageiro
    Backend->>Mock: consulta voo
    Mock-->>Backend: companhia + atrasoHoras
    Backend->>Oracle: aciona com vooId + passageiro
    Oracle->>Contrato: cadastrarVoo(vooId, empresa, passageiro)
    Oracle->>Contrato: registrarAtraso(vooId, atrasoHoras)
    Contrato->>Contrato: calcularMulta(atrasoHoras)
    alt atraso acima de 2h e fundo suficiente
        Contrato->>Passageiro: transfere 0,01 ETH
        Contrato-->>Oracle: PagamentoRealizado + QuitacaoEmitida
    else fundo insuficiente ou atraso abaixo do limite
        Contrato-->>Oracle: retorna mensagem sem transferir
    end
    Oracle-->>Backend: resultado + hash da transação
    Backend-->>Frontend: resultado + hash da transação
```

## Fluxo

1. A companhia consulta seu saldo pela interface e deposita o fundo de
   garantia diretamente no contrato (`depositarFundo()` é uma transação
   assinada pela própria carteira dela, sem passar pelo backend).
2. O passageiro informa o voo e conecta sua carteira no frontend.
3. O backend consulta o banco mockado para obter a companhia e o atraso do
   voo, e repassa esses dados ao Oracle.
4. O Oracle é o único componente autorizado a escrever no contrato: primeiro
   cadastra o voo (se ainda não existir), depois registra o atraso.
5. O contrato calcula a multa internamente. Dependendo do resultado, a
   execução segue por um dos dois ramos do `alt`:
   - **atraso acima de 2h e fundo suficiente:** o contrato transfere a
     indenização ao passageiro e emite `PagamentoRealizado` e
     `QuitacaoEmitida`;
   - **fundo insuficiente ou atraso dentro do limite:** o atraso já ficou
     registrado, mas nenhuma transferência ocorre — o Oracle recebe apenas
     uma mensagem explicando o motivo.
6. O resultado (com o hash da transação, quando houver) volta pela mesma
   cadeia até o frontend.

