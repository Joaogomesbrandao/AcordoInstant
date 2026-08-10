import { createSystem } from "./src/bootstrap.js";

const { app, config } = createSystem();

app.listen(config.port, config.host, () => {
  console.log(
    `AcordoInstant backend escutando em http://${config.host}:${config.port}`
  );
});

