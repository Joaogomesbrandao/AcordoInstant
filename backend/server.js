import { montarSistema } from "./src/bootstrap.js";

const { app, config, log } = await montarSistema();

app.listen(config.porta, config.host, () => {
  log.evento({
    rotulo: "BACKEND NO AR",
    cor: "verde",
    resumo: `http://${config.host}:${config.porta}`,
    detalhes: [`logs em ${log.destino}`]
  });
});
