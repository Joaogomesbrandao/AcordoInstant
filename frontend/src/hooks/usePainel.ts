import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carrega um painel e o mantém atualizado.
 *
 * A atualização periódica não é enfeite: o oráculo apura os voos por conta
 * própria, então a tela precisa refletir uma mudança que ninguém pediu ali.
 * Sem isso, o usuário veria "aguardando apuração" mesmo depois de o
 * contrato já ter pago.
 */
export function usePainel<T>(carregar: () => Promise<T>, intervaloMs = 4000) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Mantém a referência estável para o efeito não reiniciar a cada render.
  const carregarRef = useRef(carregar);
  carregarRef.current = carregar;

  const atualizar = useCallback(async () => {
    try {
      setDados(await carregarRef.current());
      setErro(null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Falha ao carregar');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;

    const rodar = async () => {
      if (ativo) await atualizar();
    };

    rodar();
    const temporizador = setInterval(rodar, intervaloMs);

    return () => {
      ativo = false;
      clearInterval(temporizador);
    };
  }, [atualizar, intervaloMs]);

  return { dados, erro, carregando, atualizar };
}
