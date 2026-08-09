import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_STATE = {
  meta: {
    nextIds: {
      company: 1,
      passenger: 1,
      policy: 1
    }
  },
  companies: {},
  passengers: {},
  policies: {},
  flightStatusByCode: {},
  processingLogs: []
};

function clone(value) {
  return structuredClone(value);
}

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async ensureFile() {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }

      await writeFile(
        this.filePath,
        `${JSON.stringify(DEFAULT_STATE, null, 2)}\n`,
        "utf8"
      );
    }
  }

  async readState() {
    await this.ensureFile();
    const raw = await readFile(this.filePath, "utf8");

    if (!raw.trim()) {
      return clone(DEFAULT_STATE);
    }

    return {
      ...clone(DEFAULT_STATE),
      ...JSON.parse(raw)
    };
  }

  async getState() {
    return clone(await this.readState());
  }

  async writeState(state) {
    await this.ensureFile();
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async update(mutator) {
    this.queue = this.queue.then(async () => {
      const state = await this.readState();
      const draft = clone(state);
      const nextState = (await mutator(draft)) ?? draft;
      await this.writeState(nextState);
      return clone(nextState);
    });

    return this.queue;
  }
}

