function roundMs(value) {
  return Math.round(value * 10) / 10;
}

function nowMs() {
  return performance.now();
}

function makeRequestId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function runtimeRegion() {
  return process.env.VERCEL_REGION ?? "local";
}

function runtimeEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "local";
}

function requestHeader(request, name) {
  return request?.headers?.get(name) ?? null;
}

export function createApiPerfLogger(route, request) {
  const requestId = makeRequestId();
  const startedAt = nowMs();
  const timings = {};
  const runtime = {
    functionRegion: runtimeRegion(),
    vercelEnvironment: runtimeEnvironment(),
    incomingVercelId: requestHeader(request, "x-vercel-id")
  };

  function log(event, detail = {}) {
    console.log(JSON.stringify({
      kind: "write_api_perf",
      route,
      requestId,
      event,
      elapsedMs: roundMs(nowMs() - startedAt),
      ...runtime,
      ...detail
    }));
  }

  async function measure(event, timingKey, action) {
    log(`${event} start`);
    const phaseStartedAt = nowMs();
    try {
      return await action();
    } finally {
      const durationMs = roundMs(nowMs() - phaseStartedAt);
      timings[timingKey] = durationMs;
      log(`${event} end`, { [timingKey]: durationMs });
    }
  }

  function done(detail = {}) {
    log("response sent", {
      totalDurationMs: roundMs(nowMs() - startedAt),
      ...timings,
      ...detail
    });
  }

  function responseHeaders() {
    return {
      "x-1moment-function-region": runtime.functionRegion,
      "x-1moment-request-id": requestId
    };
  }

  return { log, measure, done, responseHeaders };
}
