const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

function getArg(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index === process.argv.length - 1) {
    return fallback;
  }

  return process.argv[index + 1];
}

async function main() {
  const baseUrl = getArg("--base-url", DEFAULT_BASE_URL);
  const flightNumber = getArg("--flight");
  const status = getArg("--status", "LANDED");
  const delayMinutes = Number(getArg("--delay", "0"));

  if (!flightNumber) {
    throw new Error("Informe --flight");
  }

  const payload = {
    flightNumber,
    status,
    delayMinutes,
    actualDepartureAt: getArg("--departure-at"),
    actualArrivalAt: getArg("--arrival-at"),
    sourceName: getArg("--source", "oracle-manual"),
    sourceReference: getArg("--source-reference"),
    notes: getArg("--notes")
  };

  const response = await fetch(`${baseUrl}/api/internal/flight-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  console.log(JSON.stringify(await response.json(), null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

