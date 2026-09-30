export type SourceHealthStatus = "ok" | "degraded" | "down";

export type SourceHealth = {
  source: string;
  status: SourceHealthStatus;
  latencyMs: number;
  checkedAt: string;
  message?: string;
};

export type HealthCheckOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  clock?: () => Date;
};

const OK_THRESHOLD_MS = 1500;
const DEGRADED_THRESHOLD_MS = 3000;

function classifyLatency(latencyMs: number, responseOk: boolean): SourceHealthStatus {
  if (!responseOk) return "degraded";
  if (latencyMs < OK_THRESHOLD_MS) return "ok";
  if (latencyMs < DEGRADED_THRESHOLD_MS) return "degraded";
  return "down";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (reason) => { clearTimeout(timer); reject(reason); },
    );
  });
}

export async function checkMercadoLibreHealth(options: HealthCheckOptions = {}): Promise<SourceHealth> {
  const {
    fetchImpl = fetch,
    timeoutMs = 2500,
    now = () => performance.now(),
    clock = () => new Date(),
  } = options;
  const start = now();
  try {
    const response = await withTimeout(fetchImpl("https://api.mercadolibre.com/sites/MCO"), timeoutMs);
    const latencyMs = Math.max(0, Math.round(now() - start));
    return {
      source: "mercadolibre",
      status: classifyLatency(latencyMs, response.ok),
      latencyMs,
      checkedAt: clock().toISOString(),
      ...(response.ok ? {} : { message: `HTTP ${response.status}` }),
    };
  } catch (error) {
    const latencyMs = Math.max(0, Math.round(now() - start));
    return {
      source: "mercadolibre",
      status: "down",
      latencyMs,
      checkedAt: clock().toISOString(),
      message: error instanceof Error ? error.message : "error desconocido",
    };
  }
}

export const sourceChecks: Array<(options?: HealthCheckOptions) => Promise<SourceHealth>> = [
  checkMercadoLibreHealth,
];

export async function runSourceHealthChecks(options: HealthCheckOptions = {}): Promise<SourceHealth[]> {
  const results = await Promise.allSettled(sourceChecks.map((check) => check(options)));
  return results.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    const clock = options.clock ?? (() => new Date());
    return {
      source: `check-${index}`,
      status: "down",
      latencyMs: 0,
      checkedAt: clock().toISOString(),
      message: result.reason instanceof Error ? result.reason.message : "check falló",
    } satisfies SourceHealth;
  });
}
