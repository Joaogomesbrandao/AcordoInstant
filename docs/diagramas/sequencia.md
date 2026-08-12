# Diagrama de sequência

O caminho completo, do embarque ao depósito — incluindo o caso em que o
passageiro ainda não é usuário da plataforma quando o voo atrasa.

```mermaid
sequenceDiagram
    autonumber
    participant C as Companhia aérea
    participant B as Backend
    participant SC as SeguroVoo (blockchain)
    participant O as Oráculo
    participant P as Passageiro

    Note over C,SC: 1. Venda da passagem e depósito da garantia

    C->>B: embarcar passageiro (voo, nome, CPF)
    B->>B: valida CPF e calcula hashCpf(pepper, cpf)
    Note right of B: nome e CPF ficam no servidor
    B->>SC: registrarBilhete(codigo, hashCpf) + R$ 500,00
    SC-->>B: BilheteRegistrado
    Note over SC: garantia travada no escrow

    Note over O,SC: 2. Apuração automática — sem ação humana

    O->>O: procura voos pendentes com embarque encerrado
    O->>O: lê o horário real na base externa
    O->>SC: reportarChegada(codigo, chegadaReal)

    SC->>SC: atrasoMinutos > 4h?

    alt Atraso acima de 4 horas
        SC->>SC: bilhete = Indenizado

        alt CPF já tem carteira vinculada
            SC->>P: deposita R$ 500,00 na carteira
            SC-->>O: IndenizacaoDepositada
        else CPF ainda sem cadastro
            SC->>SC: creditoRetido[hashCpf] += R$ 500,00
            SC-->>O: IndenizacaoRetida
        end

        SC-->>O: QuitacaoEmitida
        Note over SC: prova de quitação dos danos materiais
    else Dentro do limite
        SC->>SC: saldoLiberado[companhia] += R$ 500,00
        SC-->>O: GarantiaLiberadaParaCompanhia
        Note over C: companhia pode resgatar
    end

    Note over P,SC: 3. Cadastro libera o que estava retido

    P->>B: cadastro (nome, CPF, chave pública)
    B->>SC: vincularCarteira(hashCpf, carteira)
    SC->>P: deposita todo o crédito retido
    SC-->>B: CarteiraVinculada + IndenizacaoDepositada

    Note over P: o passageiro nunca assinou<br/>nenhuma transação
```

## Pontos de atenção

**O passageiro não aparece assinando nada.** Ele só recebe. Não existe função
de saque para ele no contrato — apenas depósito.

**A apuração e o pagamento são a mesma transação.** `reportarChegada` percorre
todos os bilhetes do voo e resolve cada um; não há um segundo passo que possa
ficar pendente.

**O dinheiro não se perde se o passageiro não existir no sistema.** Ele fica
reservado ao hash do CPF por tempo indeterminado, e o cadastro é o gatilho que
o libera.
