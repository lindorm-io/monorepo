import { ServerError } from "@lindorm/errors";
import type { IIrisSource } from "@lindorm/iris";
import type { IProteusSource } from "@lindorm/proteus";
import type { PylonHttpCallback, PylonHttpContext } from "../../types/index.js";

/**
 * Every source role a deployment can configure. Readiness answers "can this
 * instance serve traffic right now", so it must cover all four: `kv` and `cache`
 * can be separately deployed instances, and an instance whose session store is
 * unreachable reports green while every login on it fails.
 */
type ReadinessSources = {
  bus?: IIrisSource;
  cache?: IProteusSource;
  db?: IProteusSource;
  kv?: IProteusSource;
};

/**
 * Liveness deliberately checks the DURABLE I/O only. It answers "did this
 * process come up", and restarting a container cannot fix an unreachable
 * ephemeral store any more than it can fix the database — the narrower set keeps
 * a kv/cache blip from thrashing pods that readiness already drained.
 */
type LivenessSources = {
  bus?: IIrisSource;
  db?: IProteusSource;
};

const ROLES = ["db", "kv", "cache", "bus"] as const;

const pingSources = async (sources: ReadinessSources): Promise<Array<string>> => {
  const failures: Array<string> = [];
  const pinged = new Set<IIrisSource | IProteusSource>();

  for (const role of ROLES) {
    const source = sources[role];
    if (!source) continue;

    // `cache` falls back to `kv` when the deployment runs one ephemeral store,
    // so the SAME instance arrives under two roles. Ping it once, reported under
    // the first role that named it — a second ping proves nothing and doubles
    // the probe's cost on every scrape.
    if (pinged.has(source)) continue;
    pinged.add(source);

    try {
      if (!(await source.ping())) failures.push(role);
    } catch {
      failures.push(role);
    }
  }

  return failures;
};

const assertHealthy = (failures: Array<string>): void => {
  if (failures.length > 0) {
    throw new ServerError("One or more health checks failed", {
      code: "health_check_failed",
      title: "Health Check Failed",
      details: `One or more upstream sources failed their health check: ${failures.join(", ")}.`,
      type: "urn:lindorm:pylon:error:health_check_failed",
      data: { failures },
      status: ServerError.Status.ServiceUnavailable,
    });
  }
};

/**
 * Readiness (`/ready`): pings EVERY configured source on every call, so it
 * reflects the current state of the upstream I/O — for load-balancer / readiness
 * probes deciding whether this instance should receive traffic. Roles the
 * deployment did not configure are simply absent, not a failure. Returns
 * `undefined` (a pure 204) when there is no I/O to check at all.
 */
export const buildReadinessCallback = <C extends PylonHttpContext>(
  sources: ReadinessSources,
): PylonHttpCallback<C> | undefined => {
  if (!ROLES.some((role) => sources[role])) return undefined;

  return async () => {
    assertHealthy(await pingSources(sources));
  };
};

/**
 * Liveness (`/health`): verifies I/O succeeded **at least once**, then latches
 * that success and short-circuits every later call to a pure 204. The app must
 * prove it came up (I/O reachable once), but a later DB/broker blip never flips
 * liveness — restarting the container can't fix the DB, it only thrashes. The
 * latch is per-instance (closure state), not a module global, so tests and
 * multiple pylons never leak health state. Returns `undefined` (a pure 204) when
 * there is no I/O to check.
 */
export const buildLivenessCallback = <C extends PylonHttpContext>(
  sources: LivenessSources,
): PylonHttpCallback<C> | undefined => {
  if (!sources.bus && !sources.db) return undefined;

  let healthy = false;

  return async () => {
    if (healthy) return;
    assertHealthy(await pingSources(sources));
    healthy = true;
  };
};
