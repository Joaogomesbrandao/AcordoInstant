import { createHash } from "node:crypto";

function proofHash(payload) {
  return `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export class ManualFlightStatusProvider {
  constructor(store) {
    this.store = store;
  }

  async upsertStatus(input) {
    const flightNumber = String(input.flightNumber ?? "").trim().toUpperCase();
    const status = String(input.status ?? "").trim().toUpperCase();
    const delayMinutes = Number(input.delayMinutes ?? 0);

    if (!flightNumber) {
      const error = new Error("flightNumber e obrigatorio");
      error.statusCode = 400;
      throw error;
    }

    if (!status) {
      const error = new Error("status e obrigatorio");
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
      const error = new Error("delayMinutes deve ser um numero positivo");
      error.statusCode = 400;
      throw error;
    }

    const payload = {
      flightNumber,
      status,
      delayMinutes,
      actualDepartureAt: input.actualDepartureAt ?? null,
      actualArrivalAt: input.actualArrivalAt ?? null,
      sourceName: input.sourceName ?? "manual-provider",
      sourceReference: input.sourceReference ?? null,
      notes: input.notes ?? null,
      reportedAt: new Date().toISOString()
    };

    payload.proofHash = proofHash(payload);

    await this.store.update((state) => {
      state.flightStatusByCode[flightNumber] = payload;
      state.processingLogs.push({
        type: "flight_status_upserted",
        flightNumber,
        reportedAt: payload.reportedAt,
        proofHash: payload.proofHash
      });
      return state;
    });

    return payload;
  }

  async getStatus(flightNumber) {
    const normalized = String(flightNumber ?? "").trim().toUpperCase();
    const state = await this.store.getState();
    const status = state.flightStatusByCode[normalized];

    if (!status) {
      const error = new Error(`Nenhum status cadastrado para o voo ${normalized}`);
      error.statusCode = 404;
      throw error;
    }

    return status;
  }
}

