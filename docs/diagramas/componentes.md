# Diagrama de componentes

Componentes do AcordoInstant e a fronteira entre o que fica na blockchain e o
que fica fora dela.

```mermaid
flowchart TB
    subgraph navegador["Navegador"]
        cliente["Painel do passageiro<br/>cadastro · voos · valor recebido"]
        companhia["Painel da companhia<br/>embarque · garantias"]
        tjpb["Painel do TJPB<br/>auditoria · quitações"]
    end

    subgraph servidor["Servidor — fora da blockchain"]
        api["Backend (Express)<br/>API dos três perfis"]
        dados[("Dados pessoais<br/>nome · CPF em claro")]
        oraculo["Serviço do oráculo<br/>apura voos pendentes"]
        base[("Base de voos<br/>20 voos · horário real")]
        logs[("logs/blockchain.log")]
        obs["Observador da cadeia<br/>lê eventos bloco a bloco"]
    end

    subgraph cadeia["Blockchain — rede local"]
        contrato["SeguroVoo.sol<br/>termos · escrow · quitação"]
    end

    cliente -->|"HTTP"| api
    companhia -->|"HTTP"| api
    tjpb -->|"HTTP"| api

    api --- dados
    oraculo --- base

    api -->|"assina como companhia<br/>cadastrarVoo · registrarBilhete"| contrato
    api -->|"assina como plataforma<br/>vincularCarteira"| contrato
    oraculo -->|"assina como oráculo<br/>reportarChegada"| contrato
    api -->|"lê (view)"| contrato

    contrato -.->|"eventos"| obs
    obs --> logs

    classDef fora fill:#fdf6e8,stroke:#d9a441,color:#5c4a1f
    classDef dentro fill:#e7ecf3,stroke:#1d3557,color:#142640
    classDef tela fill:#e2efeb,stroke:#2f7a6b,color:#1f5b4f

    class api,dados,oraculo,base,logs,obs fora
    class contrato dentro
    class cliente,companhia,tjpb tela
```

## O que a fronteira separa

**Fica fora da cadeia:** nome e CPF em claro, a base de horários dos voos e
todo o registro de log. O CPF é a chave do cliente no servidor, mas só o hash
dele cruza a fronteira.

**Vai para a cadeia:** os termos do contrato, a identificação do bilhete (um
hash), o status apurado do voo, a confirmação do pagamento e o termo de
quitação.

## Quem assina o quê

Cada seta de escrita sai de uma carteira diferente, e o contrato recusa a
combinação errada. A companhia não consegue reportar um atraso; o oráculo não
consegue embarcar passageiros; o TJPB não tem nenhuma seta de escrita.
