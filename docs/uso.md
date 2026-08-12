# Roteiro de demonstração

Como percorrer o sistema pela interface e ver o contrato executando sozinho.
Assume a rede no ar e a aplicação rodando (ver [`deploy.md`](./deploy.md)).

Abra `http://localhost:3000`. A tela inicial oferece os três perfis.

## 1. Companhia aérea — vender a passagem e depositar a garantia

Entre como **Sou companhia aérea**.

No formulário *Embarcar passageiro*:

1. Escolha um voo com atraso grande, por exemplo **G31702** (REC → BSB,
   atraso real de 4 h 45).
2. Nome: `Ana Souza`.
3. CPF: `111.444.777-35`.
4. Clique em **Embarcar e depositar R$ 500,00**.

O painel mostra o voo com o selo *Aguardando oráculo* e R$ 500,00 em escrow.
No terminal, o log registra o cadastro do voo e o bilhete.

> Aproveite a janela de embarque (15 s) para embarcar um segundo passageiro no
> mesmo voo — por exemplo `Bruno Lima`, CPF `222.555.888-46`. Depois que o
> oráculo apura, o contrato recusa novos bilhetes naquele voo.

Repita para um voo pontual, por exemplo **AD4021** (JPA → GRU, chegou
adiantado), para ver o outro desfecho.

## 2. O oráculo apura sozinho

Não faça nada. Em poucos segundos o painel muda sozinho:

- **G31702** passa a *Atrasado 4h45*, e cada passageiro aparece com
  "R$ 500,00 pagos ao passageiro";
- **AD4021** passa a *Pontual*, e a garantia aparece como devolvida.

No terminal:

```
16:59:34  CHEGADA REPORTADA     G31702 · prevista 03/08 12:20 · real 03/08 17:05 · atraso 4h45 · ATRASADO
                                regra acionada: indenizar passageiros · tx 0xd8b8…a2b0 · bloco 7 · gas 156.228
16:59:34  INDENIZACAO RETIDA    G31702 · R$ 500,00 reservados para 0x7ea2…8b5d · passageiro ainda sem cadastro
                                credito acumulado R$ 500,00
16:59:34  QUITACAO EMITIDA      G31702 · R$ 500,00 · atraso 4h45 · passageiro 0x7ea2…8b5d
                                quitacao dos danos materiais imediatos em 12/08 16:59
16:59:34  CHEGADA REPORTADA     AD4021 · prevista 03/08 09:45 · real 03/08 09:40 · atraso no horario · PONTUAL
                                garantias devolvidas a companhia · tx 0xb835…4afe · bloco 8 · gas 90.429
16:59:34  GARANTIA DEVOLVIDA    AD4021 · R$ 500,00 liberados para 0xf39F…2266 · voo pontual
                                saldo resgatavel R$ 500,00
```

Repare em **INDENIZACAO RETIDA**: a Ana ainda não é usuária da plataforma, e o
contrato guardou o dinheiro em nome do hash do CPF dela.

Ainda no painel da companhia, o bloco *Garantias liberadas* mostra R$ 500,00
disponíveis. Clique em **Resgatar para a carteira**.

## 3. Passageiro — o dinheiro cai no cadastro

Clique em **Trocar perfil** e entre como **Sou passageiro** → aba **Criar
conta**:

1. Nome: `Ana Souza`
2. CPF: `111.444.777-35`
3. Chave pública: escolha uma das carteiras de teste sugeridas no campo
   (ex.: `0x15d3…6A65`)

Ao confirmar, o painel abre já mostrando **R$ 500,00 já depositado na sua
carteira** e o saldo da carteira em `10.000,5 ETH`.

Não houve botão de saque em momento algum. O contrato vinculou a carteira ao
hash do CPF e depositou o valor retido na mesma transação do cadastro:

```
17:02:11  CARTEIRA VINCULADA    passageiro 0x7ea2…8b5d · carteira 0x15d3…6A65
                                creditos retidos serao depositados nesta carteira
17:02:11  INDENIZACAO PAGA      G31702 · R$ 500,00 depositados em 0x15d3…6A65 · passageiro 0x7ea2…8b5d
```

A lista de voos mostra os dois voos: o atrasado com *Indenização depositada* e
`+R$ 500,00`; o pontual com *Voo dentro do prazo · sem indenização*.

## 4. TJPB — auditar sem interferir

**Trocar perfil** → **Sou o TJPB**.

O painel mostra a cópia do registro: contratos de voo, bilhetes segurados,
indenizações executadas e o total pago. A tabela **Termos de quitação** traz,
por bilhete, o valor, o instante e o hash da transação.

É o que o Tribunal consultaria se a mesma pessoa ingressasse no Juizado
pedindo indenização por um atraso já quitado automaticamente.

Note que o painel não tem nenhum botão de ação — não por omissão da
interface, mas porque o contrato não oferece nenhuma função de escrita ao
TJPB.

Note também que em nenhum lugar do painel aparece um nome ou um CPF: o
passageiro é sempre um hash.

## Casos que valem demonstrar

| Voo | Atraso real | O que acontece | Por quê |
|---|---|---|---|
| `LA3890` | 4 h 05 | **Indeniza** | Acima do limite por 5 minutos |
| `LA4115` | 3 h 45 | **Não indeniza** | Abaixo do limite por 15 minutos |
| `G32671` | 5 h 30 | Indeniza | Chegada no dia seguinte |
| `G32204` | 0 min | Não indeniza | Chegou no horário exato |
| `AD4021` | adiantado | Não indeniza | Chegou 5 min antes |

Os dois primeiros são os mais interessantes: mostram que a regra é aplicada
sobre o minuto, e não sobre a hora arredondada.

## Se algo não acontecer

**O painel não muda depois de embarcar.** O oráculo respeita a janela de
embarque de 15 s antes de apurar. Espere, ou force com:

```bash
curl -X POST http://127.0.0.1:3001/api/oraculo/apurar
```

**"Voo já foi apurado e não aceita novos passageiros".** Correto: aquele voo
já pousou. Escolha outro código na lista.

**"Este CPF já possui cadastro".** Use a aba **Entrar** com o mesmo CPF, ou
rode `npm run reset` para zerar os cadastros.
