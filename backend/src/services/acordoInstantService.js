import { createHash } from "node:crypto";

const ZERO_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function hashAsBytes32(value) {
  return `0x${createHash("sha256").update(String(value)).digest("hex")}`;
}

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function ensureString(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw httpError(`${fieldName} e obrigatorio`);
  }
  return normalized;
}

function ensureAddress(value, fieldName) {
  const normalized = ensureString(value, fieldName);
  if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) {
    throw httpError(`${fieldName} deve ser um endereco Ethereum valido`);
  }
  return normalized;
}

function ensurePositiveNumber(value, fieldName) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw httpError(`${fieldName} deve ser um numero positivo`);
  }
  return normalized;
}

function ensurePositiveIntegerString(value, fieldName) {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw httpError(`${fieldName} deve ser um inteiro positivo`);
  }
  return normalized;
}

function ensureKnownState(state, allowed, fieldName) {
  if (!allowed.includes(state)) {
    throw httpError(`${fieldName} invalido`);
  }
}

function sortById(collection) {
  return Object.values(collection).sort((left, right) => left.id - right.id);
}

function formatLog(type, policyId, details = {}) {
  return {
    type,
    policyId,
    createdAt: new Date().toISOString(),
    details
  };
}

export class AcordoInstantService {
  constructor({ store, flightStatusProvider, blockchainService }) {
    this.store = store;
    this.flightStatusProvider = flightStatusProvider;
    this.blockchainService = blockchainService;
  }

  async listCompanies() {
    const state = await this.store.getState();
    return sortById(state.companies);
  }

  async createCompany(input) {
    const name = ensureString(input.name, "name");
    const walletAddress = ensureAddress(input.walletAddress, "walletAddress");

    const state = await this.store.update((draft) => {
      const duplicate = Object.values(draft.companies).find(
        (company) => company.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );

      if (duplicate) {
        throw httpError("Ja existe companhia com esse endereco");
      }

      const id = draft.meta.nextIds.company++;
      draft.companies[id] = {
        id,
        name,
        walletAddress
      };
      return draft;
    });

    return state.companies[state.meta.nextIds.company - 1];
  }

  async listPassengers() {
    const state = await this.store.getState();
    return sortById(state.passengers);
  }

  async getPassenger(passengerId) {
    const state = await this.store.getState();
    const passenger = state.passengers[Number(passengerId)];

    if (!passenger) {
      throw httpError("Passageiro nao encontrado", 404);
    }

    return passenger;
  }

  async createPassenger(input) {
    const name = ensureString(input.name, "name");
    const walletAddress = ensureAddress(input.walletAddress, "walletAddress");

    const state = await this.store.update((draft) => {
      const duplicate = Object.values(draft.passengers).find(
        (passenger) =>
          passenger.walletAddress.toLowerCase() === walletAddress.toLowerCase()
      );

      if (duplicate) {
        throw httpError("Ja existe passageiro com esse endereco");
      }

      const id = draft.meta.nextIds.passenger++;
      draft.passengers[id] = {
        id,
        name,
        walletAddress
      };
      return draft;
    });

    return state.passengers[state.meta.nextIds.passenger - 1];
  }

  async listPolicies() {
    const state = await this.store.getState();
    return sortById(state.policies);
  }

  async getPolicy(policyId) {
    const state = await this.store.getState();
    const policy = state.policies[Number(policyId)];

    if (!policy) {
      throw httpError("Apolice nao encontrada", 404);
    }

    return policy;
  }

  async createPolicy(input) {
    const companyId = Number(input.companyId);
    const passengerId = Number(input.passengerId);
    const flightNumber = ensureString(input.flightNumber, "flightNumber").toUpperCase();
    const thresholdMinutes = ensurePositiveNumber(
      input.thresholdMinutes,
      "thresholdMinutes"
    );
    const compensationWei = ensurePositiveIntegerString(
      input.compensationWei,
      "compensationWei"
    );

    const ticketHash =
      input.ticketHash && input.ticketHash !== ZERO_HASH
        ? ensureString(input.ticketHash, "ticketHash")
        : hashAsBytes32(ensureString(input.ticketReference, "ticketReference"));
    const termsHash =
      input.termsHash && input.termsHash !== ZERO_HASH
        ? ensureString(input.termsHash, "termsHash")
        : hashAsBytes32(ensureString(input.termsText, "termsText"));
    const flightRefHash =
      input.flightRefHash && input.flightRefHash !== ZERO_HASH
        ? ensureString(input.flightRefHash, "flightRefHash")
        : hashAsBytes32(flightNumber);

    const createdAt = new Date().toISOString();

    const state = await this.store.update((draft) => {
      const company = draft.companies[companyId];
      const passenger = draft.passengers[passengerId];

      if (!company) {
        throw httpError("Companhia nao encontrada", 404);
      }

      if (!passenger) {
        throw httpError("Passageiro nao encontrado", 404);
      }

      const id = draft.meta.nextIds.policy++;
      draft.policies[id] = {
        id,
        companyId,
        companyAddress: company.walletAddress,
        passengerId,
        passengerAddress: passenger.walletAddress,
        flightNumber,
        thresholdMinutes,
        compensationWei,
        state: "created",
        createdAt,
        acceptedAt: null,
        cancelledAt: null,
        settlementProcessedAt: null,
        hashes: {
          ticketHash,
          termsHash,
          flightRefHash,
          acceptanceHash: null,
          statusProofHash: null,
          quitacaoHash: null
        },
        officialStatus: null,
        blockchain: {
          creation: {
            status: "not_submitted",
            txHash: null,
            lastPreparedCall: null
          },
          acceptance: {
            status: "not_submitted",
            txHash: null,
            lastPreparedCall: null
          },
          settlement: {
            status: "not_submitted",
            txHash: null,
            lastPreparedCall: null
          }
        }
      };

      draft.processingLogs.push(
        formatLog("policy_created", id, {
          companyId,
          passengerId,
          flightNumber
        })
      );

      return draft;
    });

    return state.policies[state.meta.nextIds.policy - 1];
  }

  async acceptPolicy(policyId, input) {
    const passengerId = input.passengerId ? Number(input.passengerId) : null;
    const acceptedAt = new Date().toISOString();

    const state = await this.store.update((draft) => {
      const policy = draft.policies[Number(policyId)];

      if (!policy) {
        throw httpError("Apolice nao encontrada", 404);
      }

      if (policy.state !== "created") {
        throw httpError("Apolice nao pode ser aceita neste estado");
      }

      if (passengerId && passengerId !== policy.passengerId) {
        throw httpError("passengerId nao corresponde ao passageiro da apolice");
      }

      policy.state = "accepted";
      policy.acceptedAt = acceptedAt;
      policy.hashes.acceptanceHash = hashAsBytes32(
        `${policy.id}|${policy.passengerAddress}|${policy.hashes.termsHash}|${acceptedAt}`
      );

      draft.processingLogs.push(
        formatLog("policy_accepted", policy.id, {
          acceptanceHash: policy.hashes.acceptanceHash
        })
      );

      return draft;
    });

    return state.policies[Number(policyId)];
  }

  async cancelPolicy(policyId) {
    const state = await this.store.update((draft) => {
      const policy = draft.policies[Number(policyId)];

      if (!policy) {
        throw httpError("Apolice nao encontrada", 404);
      }

      if (policy.state !== "created") {
        throw httpError("Somente apolices criadas e nao aceitas podem ser canceladas");
      }

      policy.state = "cancelled";
      policy.cancelledAt = new Date().toISOString();

      draft.processingLogs.push(formatLog("policy_cancelled", policy.id));
      return draft;
    });

    return state.policies[Number(policyId)];
  }

  async syncPolicyCreation(policyId, input) {
    const policy = await this.getPolicy(policyId);
    ensureKnownState(policy.state, ["created", "accepted"], "state");

    const blockchainResult = await this.blockchainService.registerPolicy(
      policy,
      input.signerPrivateKey
    );

    const state = await this.store.update((draft) => {
      const draftPolicy = draft.policies[Number(policyId)];
      draftPolicy.blockchain.creation = {
        status: blockchainResult.executed ? "submitted" : "prepared",
        txHash: blockchainResult.txHash ?? null,
        lastPreparedCall: blockchainResult.preparedCall
      };
      draft.processingLogs.push(
        formatLog("policy_creation_synced", draftPolicy.id, {
          executed: blockchainResult.executed,
          txHash: blockchainResult.txHash ?? null
        })
      );
      return draft;
    });

    return {
      policy: state.policies[Number(policyId)],
      blockchainResult
    };
  }

  async syncPolicyAcceptance(policyId, input) {
    const policy = await this.getPolicy(policyId);

    if (policy.state !== "accepted") {
      throw httpError("Apolice precisa estar aceita antes da sincronizacao on-chain");
    }

    const blockchainResult = await this.blockchainService.acceptPolicy(
      policy,
      input.signerPrivateKey
    );

    const state = await this.store.update((draft) => {
      const draftPolicy = draft.policies[Number(policyId)];
      draftPolicy.blockchain.acceptance = {
        status: blockchainResult.executed ? "submitted" : "prepared",
        txHash: blockchainResult.txHash ?? null,
        lastPreparedCall: blockchainResult.preparedCall
      };
      draft.processingLogs.push(
        formatLog("policy_acceptance_synced", draftPolicy.id, {
          executed: blockchainResult.executed,
          txHash: blockchainResult.txHash ?? null
        })
      );
      return draft;
    });

    return {
      policy: state.policies[Number(policyId)],
      blockchainResult
    };
  }

  async processSettlement(policyId, input) {
    const policy = await this.getPolicy(policyId);

    ensureKnownState(
      policy.state,
      ["accepted", "eligible_pending_blockchain", "no_compensation_pending_blockchain"],
      "state"
    );

    const flightStatus = await this.flightStatusProvider.getStatus(policy.flightNumber);
    const eligible = flightStatus.delayMinutes >= policy.thresholdMinutes;
    const quitacaoHash = eligible
      ? hashAsBytes32(
          `${policy.id}|${policy.passengerAddress}|${policy.compensationWei}|${flightStatus.delayMinutes}|${flightStatus.reportedAt}`
        )
      : ZERO_HASH;

    const settlementPayload = {
      delayMinutes: flightStatus.delayMinutes,
      statusProofHash: flightStatus.proofHash,
      quitacaoHash: eligible ? quitacaoHash : ZERO_HASH
    };

    const blockchainResult = await this.blockchainService.registerOfficialStatus(
      policy,
      settlementPayload,
      input.operatorPrivateKey
    );

    const nextState = eligible
      ? blockchainResult.executed
        ? "paid"
        : "eligible_pending_blockchain"
      : blockchainResult.executed
        ? "no_compensation"
        : "no_compensation_pending_blockchain";

    const state = await this.store.update((draft) => {
      const draftPolicy = draft.policies[Number(policyId)];
      draftPolicy.state = nextState;
      draftPolicy.settlementProcessedAt = new Date().toISOString();
      draftPolicy.officialStatus = {
        status: flightStatus.status,
        delayMinutes: flightStatus.delayMinutes,
        actualDepartureAt: flightStatus.actualDepartureAt,
        actualArrivalAt: flightStatus.actualArrivalAt,
        sourceName: flightStatus.sourceName,
        sourceReference: flightStatus.sourceReference,
        reportedAt: flightStatus.reportedAt,
        eligible
      };
      draftPolicy.hashes.statusProofHash = flightStatus.proofHash;
      draftPolicy.hashes.quitacaoHash = eligible ? quitacaoHash : null;
      draftPolicy.blockchain.settlement = {
        status: blockchainResult.executed ? "submitted" : "prepared",
        txHash: blockchainResult.txHash ?? null,
        lastPreparedCall: blockchainResult.preparedCall
      };

      draft.processingLogs.push(
        formatLog("policy_settlement_processed", draftPolicy.id, {
          eligible,
          executed: blockchainResult.executed,
          txHash: blockchainResult.txHash ?? null,
          delayMinutes: flightStatus.delayMinutes
        })
      );
      return draft;
    });

    return {
      policy: state.policies[Number(policyId)],
      blockchainResult
    };
  }

  async upsertFlightStatus(input) {
    return this.flightStatusProvider.upsertStatus(input);
  }

  async getFlightStatus(flightNumber) {
    return this.flightStatusProvider.getStatus(flightNumber);
  }

  // Ponte usada pelo painel do passageiro (frontend) antes de assinar
  // registrarAtraso: reaproveita o mesmo ManualFlightStatusProvider/Oracle
  // que ja alimenta getFlightStatus, so traduzindo vooId (numero do voo do
  // contrato) e horas (atrasoHorasOficial) para a terminologia existente
  // (flightNumber em minutos).
  async consultarAtrasoOficialVoo(vooId, passageiroAddress) {
    ensureAddress(passageiroAddress, "passageiro");
    const flightNumber = ensureString(vooId, "vooId").toUpperCase();
    const status = await this.flightStatusProvider.getStatus(flightNumber);

    return {
      vooId: flightNumber,
      atrasoHorasOficial: Math.floor(Number(status.delayMinutes) / 60),
      statusOficial: status.status,
      proofHash: status.proofHash,
      reportadoEm: status.reportedAt
    };
  }
}

