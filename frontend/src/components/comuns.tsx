import type { ReactNode } from 'react';
import type { Regra, Voo } from '../tipos';
import { curto, dataHora, seloDoVoo } from '../utils/formato';

export interface Indicador {
  valor: ReactNode;
  rotulo: string;
  /** Linha menor sob o rótulo, para a unidade ou um detalhe do valor. */
  nota?: string;
}

/**
 * Linha de indicadores no topo de um painel.
 *
 * O número de colunas é fixo, e não automático: com `auto-fit`, uma última
 * linha incompleta deixava buracos visíveis no meio do painel. Quem monta a
 * linha escolhe uma contagem que fecha certo.
 */
export function Indicadores({ itens, colunas = 4 }: { itens: Indicador[]; colunas?: 2 | 3 | 4 }) {
  return (
    <div className={`indicadores indicadores-${colunas}`}>
      {itens.map((item) => (
        <div className="indicador" key={item.rotulo}>
          <span className="indicador-valor">{item.valor}</span>
          <span className="indicador-rotulo">{item.rotulo}</span>
          {item.nota ? <span className="indicador-nota">{item.nota}</span> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Faixa com a regra do contrato.
 *
 * Aparece nos três painéis de propósito: cliente, companhia e Tribunal
 * enxergam exatamente a mesma condição, lida do próprio contrato. É o que
 * torna o acordo verificável por qualquer uma das partes.
 */
export function FaixaRegra({ regra, nota }: { regra: Regra; nota?: string }) {
  return (
    <div className="faixa-regra">
      <div>
        <span className="faixa-regra-etiqueta">Regra do contrato · registrada na blockchain</span>
        <p className="faixa-regra-texto">
          Atraso superior a <strong>{regra.limiarHoras} horas</strong> ⇒ pagamento automático de{' '}
          <strong>{regra.valor}</strong> por passageiro.
        </p>
        {nota ? <p className="faixa-regra-nota">{nota}</p> : null}
      </div>
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: 'erro' | 'ok' | 'info'; children: ReactNode }) {
  return <div className={`aviso aviso-${tipo}`}>{children}</div>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="vazio">{children}</p>;
}

/** Cabeçalho do voo, compartilhado pelos painéis da companhia e do TJPB. */
export function LinhaVoo({ voo, extra }: { voo: Voo; extra?: ReactNode }) {
  return (
    <header className="voo-topo">
      <div>
        <div className="voo-identificacao">
          <span className="voo-codigo">{voo.codigo}</span>
          {voo.origem ? (
            <span className="voo-rota">
              {voo.origem} → {voo.destino}
            </span>
          ) : null}
          {voo.operadora ? <span className="voo-operadora">{voo.operadora}</span> : null}
        </div>
        <div className="voo-horarios">
          <span>Chegada prevista {dataHora(voo.chegadaPrevista)}</span>
          {voo.chegadaReal ? <span>· real {dataHora(voo.chegadaReal)}</span> : null}
        </div>
      </div>

      <div className="voo-estado">
        <span className={seloDoVoo(voo)}>{voo.statusRotulo}</span>
        {extra}
      </div>
    </header>
  );
}

/** Endereço/hash monoespaçado, com o valor completo no title. */
export function Hash({ valor, rotulo }: { valor: string; rotulo?: string }) {
  return (
    <span className="hash" title={valor}>
      {rotulo ? <span className="hash-rotulo">{rotulo}</span> : null}
      <code>{curto(valor)}</code>
    </span>
  );
}
