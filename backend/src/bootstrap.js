import { carregarConfig } from "./config.js";
import { criarApp } from "./app.js";
import { criarAcessoAoContrato } from "./servicos/contrato.js";
import { criarConsultas } from "./servicos/consultas.js";
import { criarServicoDaCompanhia } from "./servicos/companhia.js";
import { criarServicoDoCliente } from "./servicos/cliente.js";
import { criarServicoDoTribunal } from "./servicos/tribunal.js";
import { criarObservador } from "./log/observador.js";
import { RepositorioClientes } from "./dominio/clientes.js";
import { Manifesto } from "./dominio/manifesto.js";
import { criarOraculo } from "../../oracle/oraculo.js";
import { criarLogger } from "../../lib/logger.js";
import { curto } from "../../lib/formato.js";

/**
 * Monta o sistema inteiro: contrato, serviços dos três perfis, observador da
 * cadeia e o oráculo.
 *
 * O oráculo sobe junto com o backend de propósito. É ele que faz a
 * verificação automática prometida pela solução: sem nenhuma ação humana,
 * o voo é apurado e o contrato executado.
 */
export async function montarSistema(ajustes = {}) {
  const config = carregarConfig(ajustes);
  const log = criarLogger("blockchain.log");

  const acesso = criarAcessoAoContrato(config);
  await acesso.verificar();

  const clientes = new RepositorioClientes(config.arquivoClientes);
  const manifesto = new Manifesto(config.arquivoManifesto);

  const consultas = criarConsultas({ acesso, manifesto });

  // O oráculo vem antes da companhia porque ela precisa avisá-lo do instante
  // exato em que cada voo foi cadastrado, que é quando a espera começa.
  const oraculo = criarOraculo({
    acesso,
    log,
    esperaSegundos: config.esperaApuracaoSegundos
  });

  const companhia = criarServicoDaCompanhia({ acesso, consultas, manifesto, oraculo });
  const cliente = criarServicoDoCliente({ acesso, consultas, clientes });
  const tribunal = criarServicoDoTribunal({ acesso, consultas, manifesto });

  const observador = criarObservador({ acesso, log });

  log.secao(
    "AcordoInstant · backend",
    `rede ${config.rede} (chainId ${config.chainId}) · contrato ${curto(acesso.endereco)}`
  );

  await observador.iniciar();
  await oraculo.iniciar(config.intervaloOraculoSegundos);

  const app = criarApp({
    config,
    cliente,
    companhia,
    tribunal,
    oraculo,
    observador,
    acesso
  });

  return { app, config, log, acesso, observador, oraculo, cliente, companhia, tribunal };
}
