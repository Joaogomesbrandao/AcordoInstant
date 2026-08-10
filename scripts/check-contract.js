import { readFileSync } from "node:fs";
import path from "node:path";
import solc from "solc";

const contractPath = path.join(process.cwd(), "contracts", "SeguroParametrico.sol");
const source = readFileSync(contractPath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    "SeguroParametrico.sol": {
      content: source
    }
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode"]
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = output.errors ?? [];
const hardErrors = errors.filter((entry) => entry.severity === "error");

if (errors.length > 0) {
  for (const entry of errors) {
    console.log(`${entry.severity.toUpperCase()}: ${entry.formattedMessage}`);
  }
}

if (hardErrors.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Contrato compilado com sucesso.");
}

