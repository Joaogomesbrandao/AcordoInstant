# Diagrama de sequência

O caminho completo, do embarque ao depósito, incluindo o caso em que o
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

    Note over O,SC: 2. Apuração automática, 7 s após o cadastro do voo

    O->>O: procura voos pendentes com a janela vencida
    O->>O: lê o horário real na base externa
    O->>SC: reportarChegada(codigo, chegadaReal)
    Note right of O: nenhuma ação humana;<br/>só o oráculo pode escrever isto

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

    Note over P,SC: 3. Cadastro e saque único do que ficou retido

    P->>B: cadastro (nome, CPF, chave pública)
    B->>SC: vincularCarteira(hashCpf, carteira)
    SC-->>B: CarteiraVinculada (com o valor pendente)

    alt Havia crédito retido de antes do cadastro
        Note over P: painel mostra<br/>"Receber valores pendentes"
        P->>B: sacar
        B->>SC: sacarCreditoRetido(hashCpf)
        SC->>P: deposita o valor acumulado
        SC-->>B: CreditoRetidoSacado
        Note over P: o botão some: creditoRetido zerou
    end

    Note over P,SC: 4. Daqui em diante é tudo automático

    O->>SC: reportarChegada de um novo voo atrasado
    SC->>P: deposita direto na carteira vinculada
```

## Pontos de atenção

**A apuração e o pagamento são a mesma transação.** `reportarChegada` percorre
todos os bilhetes do voo e resolve cada um; não há um segundo passo que possa
ficar pendente.

**O dinheiro não se perde se o passageiro não existir no sistema.** Ele fica
reservado ao hash do CPF por tempo indeterminado, e o cadastro é o que dá a
ele uma carteira para receber.

**O saque acontece no máximo uma vez por cliente.** Só existe para o valor
apurado antes de haver carteira vinculada. Depois dele, `creditoRetido` zera e
o passo 4 passa a ser o único caminho: depósito direto, sem pedido.

**A apuração é automática, mas não instantânea.** O oráculo espera 7 segundos
a partir do cadastro do voo, para a companhia conseguir embarcar todos os
passageiros antes de o contrato executar e fechar o voo.
