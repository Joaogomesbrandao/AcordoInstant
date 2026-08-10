import express from "express";

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function createApp({ service, blockchainService, flightContractService, config }) {
  const app = express();

  // Em desenvolvimento, o frontend costuma rodar no Vite (porta 3000) e o
  // backend na 3001. Em produção/local build, o backend também pode servir o
  // `frontend/dist`, então o CORS continua aqui apenas para manter ambos os
  // modos funcionando sem configuração extra.
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      blockchainEnabled: blockchainService.isConfigured(),
      providerMode: config.providerMode
    });
  });

  app.get(
    "/api/companies",
    asyncHandler(async (_req, res) => {
      res.json(await service.listCompanies());
    })
  );

  app.post(
    "/api/companies",
    asyncHandler(async (req, res) => {
      const company = await service.createCompany(req.body);
      res.status(201).json(company);
    })
  );

  app.get(
    "/api/passengers",
    asyncHandler(async (_req, res) => {
      res.json(await service.listPassengers());
    })
  );

  app.post(
    "/api/passengers",
    asyncHandler(async (req, res) => {
      const passenger = await service.createPassenger(req.body);
      res.status(201).json(passenger);
    })
  );

  app.get(
    "/api/policies",
    asyncHandler(async (_req, res) => {
      res.json(await service.listPolicies());
    })
  );

  app.get(
    "/api/policies/:policyId",
    asyncHandler(async (req, res) => {
      res.json(await service.getPolicy(req.params.policyId));
    })
  );

  app.post(
    "/api/policies",
    asyncHandler(async (req, res) => {
      const policy = await service.createPolicy(req.body);
      res.status(201).json(policy);
    })
  );

  app.post(
    "/api/policies/:policyId/accept",
    asyncHandler(async (req, res) => {
      res.json(await service.acceptPolicy(req.params.policyId, req.body));
    })
  );

  app.post(
    "/api/policies/:policyId/cancel",
    asyncHandler(async (req, res) => {
      res.json(await service.cancelPolicy(req.params.policyId, req.body));
    })
  );

  app.post(
    "/api/policies/:policyId/blockchain/register",
    asyncHandler(async (req, res) => {
      res.json(
        await service.syncPolicyCreation(req.params.policyId, req.body ?? {})
      );
    })
  );

  app.post(
    "/api/policies/:policyId/blockchain/accept",
    asyncHandler(async (req, res) => {
      res.json(
        await service.syncPolicyAcceptance(req.params.policyId, req.body ?? {})
      );
    })
  );

  app.post(
    "/api/policies/:policyId/process-settlement",
    asyncHandler(async (req, res) => {
      res.json(
        await service.processSettlement(req.params.policyId, req.body ?? {})
      );
    })
  );

  app.get(
    "/api/flight-status/:flightNumber",
    asyncHandler(async (req, res) => {
      res.json(await service.getFlightStatus(req.params.flightNumber));
    })
  );

  app.post(
    "/api/internal/flight-status",
    asyncHandler(async (req, res) => {
      const update = await service.upsertFlightStatus(req.body);
      res.status(201).json(update);
    })
  );

  app.post(
    "/api/blockchain/escrow/deposit",
    asyncHandler(async (req, res) => {
      res.json(await blockchainService.depositEscrow(req.body ?? {}));
    })
  );

  // Consultada pelo painel do passageiro (frontend) antes de assinar
  // registrarAtraso no contrato. O formato de erro ({ erro }) segue o que o
  // frontend ja espera nessa chamada especifica; as demais rotas continuam
  // usando { error }, sem alterar o contrato existente da API.
  app.post(
    "/voos/:vooId/consultar",
    async (req, res) => {
      try {
        const { passageiro } = req.body ?? {};
        const resultado = await service.consultarAtrasoOficialVoo(req.params.vooId, passageiro);
        res.json(resultado);
      } catch (error) {
        const statusCode = error.statusCode ?? 500;
        res.status(statusCode).json({ erro: error.message ?? "Erro interno" });
      }
    }
  );

  // Rotas usadas pelo painel da companhia (frontend). A companhia e unica e
  // fixa: todas essas acoes sao assinadas pelo backend com a mesma chave
  // (OPERATOR_PRIVATE_KEY), a interface nunca lida com carteira/assinatura.
  app.get(
    "/companhia/saldo",
    asyncHandler(async (_req, res) => {
      res.json(await flightContractService.consultarSaldo());
    })
  );

  app.get(
    "/companhia/voos",
    asyncHandler(async (_req, res) => {
      res.json(await flightContractService.listarVoos());
    })
  );

  app.post(
    "/companhia/voos",
    asyncHandler(async (req, res) => {
      const { vooId, horarioPartida, horarioChegada } = req.body ?? {};
      res.status(201).json(
        await flightContractService.cadastrarVoo(vooId, horarioPartida, horarioChegada)
      );
    })
  );

  app.post(
    "/companhia/depositar-fundo",
    asyncHandler(async (req, res) => {
      const { valorEth } = req.body ?? {};
      res.json(await flightContractService.depositarFundo(valorEth));
    })
  );

  app.post(
    "/companhia/resgatar-fundo",
    asyncHandler(async (req, res) => {
      const { valorEth } = req.body ?? {};
      res.json(await flightContractService.resgatarFundo(valorEth));
    })
  );

  // A companhia inscreve um passageiro ja cadastrado (por id, resolvido a
  // partir do nome escolhido na interface) em um voo dela — o passageiro
  // nao assina nada, so recebe o deposito caso tenha direito depois.
  app.post(
    "/companhia/voos/:vooId/inscrever",
    asyncHandler(async (req, res) => {
      const { passengerId } = req.body ?? {};
      const passenger = await service.getPassenger(passengerId);
      res.json(
        await flightContractService.inscreverPassageiro(
          req.params.vooId,
          passenger.walletAddress
        )
      );
    })
  );

  if (config.serveFrontend) {
    app.use(express.static(config.frontendDistDir));
    app.use((req, res, next) => {
      if (req.method !== "GET") {
        next();
        return;
      }

      if (
        req.path === "/health" ||
        req.path === "/api" ||
        req.path.startsWith("/api/") ||
        req.path === "/voos" ||
        req.path.startsWith("/voos/") ||
        req.path === "/companhia" ||
        req.path.startsWith("/companhia/")
      ) {
        next();
        return;
      }

      res.sendFile(config.frontendIndexFile);
    });
  }

  app.use((req, res) => {
    res.status(404).json({
      error: `Rota nao encontrada: ${req.method} ${req.originalUrl}`
    });
  });

  app.use((error, _req, res, _next) => {
    const statusCode = error.statusCode ?? 500;
    res.status(statusCode).json({
      error: error.message ?? "Erro interno"
    });
  });

  return app;
}
