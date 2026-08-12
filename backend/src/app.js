import path from "node:path";
import express from "express";

import { listarVoosComAtraso } from "../../oracle/voos.mock.js";
import { ErroApi } from "./erros.js";

/**
 * API do AcordoInstant.
 *
 * Uma rota por ação de cada perfil, e nada além disso. O frontend não fala
 * com a blockchain: quem assina é sempre o backend, com a carteira do papel
 * correspondente, e quem lê a cadeia também é o backend — assim existe um
 * único lugar onde o ABI e os endereços importam.
 */
export function criarApp({ config, cliente, companhia, tribunal, oraculo, observador, acesso }) {
  const app = express();

  app.use(express.json());

  // O Vite (porta 3000) e o backend (3001) são origens diferentes em
  // desenvolvimento; em produção o mesmo processo serve os dois.
  app.use((req, res, proximo) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    proximo();
  });

  /** Executa a rota e, depois de uma escrita, força o log da movimentação. */
  const rota =
    (manipulador, { registrar = false } = {}) =>
    async (req, res, proximo) => {
      try {
        const resultado = await manipulador(req, res);
        if (registrar) await observador.varrer();
        res.json(resultado);
      } catch (erro) {
        proximo(erro);
      }
    };

  // --- Estado do sistema ----------------------------------------------------

  app.get(
    "/health",
    rota(async () => ({
      status: "ok",
      rede: config.rede,
      chainId: config.chainId,
      contrato: acesso.endereco
    }))
  );

  app.get("/api/regra", rota(async () => tribunal.painel().then((painel) => painel.regra)));

  /**
   * Carteiras de teste geradas na implantação da rede.
   *
   * Existe para a demonstração: a tela de cadastro do cliente oferece esses
   * endereços em vez de exigir que alguém copie do terminal. Nenhuma delas
   * nasce vinculada a um CPF — o vínculo só acontece no cadastro.
   */
  app.get(
    "/api/carteiras-de-teste",
    rota(async () => config.usuariosDeTeste)
  );

  // --- Cliente --------------------------------------------------------------

  app.post(
    "/api/cliente/cadastro",
    rota((req) => cliente.cadastrar(req.body ?? {}), { registrar: true })
  );

  app.post(
    "/api/cliente/entrar",
    rota((req) => cliente.entrar(req.body?.cpf))
  );

  app.get(
    "/api/cliente/:cpf/painel",
    rota((req) => cliente.painel(req.params.cpf))
  );

  // --- Companhia aérea ------------------------------------------------------

  app.get(
    "/api/companhia/painel",
    rota(() => companhia.painel())
  );

  app.get(
    "/api/companhia/voos-disponiveis",
    rota(() => companhia.voosDisponiveis())
  );

  app.post(
    "/api/companhia/voos",
    rota((req) => companhia.cadastrarVoo(req.body?.codigo), { registrar: true })
  );

  app.post(
    "/api/companhia/passageiros",
    rota((req) => companhia.embarcarPassageiro(req.body ?? {}), { registrar: true })
  );

  app.post(
    "/api/companhia/resgatar",
    rota((req) => companhia.resgatarGarantias(req.body?.valorWei ?? null), { registrar: true })
  );

  // --- TJPB (somente leitura) -----------------------------------------------

  app.get(
    "/api/tribunal/painel",
    rota(() => tribunal.painel(observador.catalogo))
  );

  // --- Oráculo --------------------------------------------------------------

  app.get(
    "/api/oraculo/voos",
    rota(async () => listarVoosComAtraso())
  );

  /**
   * Dispara uma apuração imediata.
   *
   * O oráculo já roda sozinho em intervalo fixo; esta rota existe para a
   * demonstração não depender do relógio — mesmo assim, quem reporta é a
   * conta do oráculo, e o horário continua vindo da base externa.
   */
  app.post(
    "/api/oraculo/apurar",
    rota(async () => ({ apurados: await oraculo.apurarPendentes() }), { registrar: true })
  );

  // --- Frontend compilado (modo processo único) -----------------------------

  if (config.servirFrontend) {
    app.use(express.static(config.pastaFrontend));
    app.use((req, res, proximo) => {
      if (req.method !== "GET" || req.path.startsWith("/api") || req.path === "/health") {
        proximo();
        return;
      }

      res.sendFile(path.join(config.pastaFrontend, "index.html"));
    });
  }

  app.use((req, res) => {
    res.status(404).json({ erro: `Rota nao encontrada: ${req.method} ${req.originalUrl}` });
  });

  app.use((erro, _req, res, _proximo) => {
    const status = erro instanceof ErroApi ? erro.status : (erro.status ?? 500);
    res.status(status).json({ erro: erro.message ?? "Erro interno" });
  });

  return app;
}
