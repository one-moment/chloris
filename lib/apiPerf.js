function roundMs(value) {
  return Math.round(value * 10) / 10;
}

function nowMs() {
  return performance.now();
}

function makeRequestId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createApiPerfLogger(route) {
  const requestId = makeRequestId();
  const startedAt = nowMs();
  const timings = {};

  function log(event, detail = {}) {
    console.log(JSON.stringify({
      kind: "write_api_perf",
      route,
      requestId,
      event,
      elapsedMs: roundMs(nowMs() - startedAt),
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

  return { log, measure, done };
}
