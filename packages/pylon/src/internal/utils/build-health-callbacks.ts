import { ServerError } from "@lindorm/errors";
import type { IIrisSource } from "@lindorm/iris";
import type { IProteusSource } from "@lindorm/proteus";
import type { PylonHttpCallback, PylonHttpContext } from "../../types/index.js";

type Sources = {
  bus?: IIrisSource;
  db?: IProteusSource;
};

const pingSources = async ({ bus, db }: Sources): Promise<Array<string>> => {
  const failures: Array<string> = [];

  if (db) {
    try {
      if (!(await db.ping())) failures.push("db");
    } catch {
      failures.push("db");
    }
  }

  if (bus) {
    try {
      if (!(await bus.ping())) failures.push("bus");
    } catch {
      failures.push("bus");
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
 * Readiness (`/ready`): pings live I/O on every call, so it reflects the current
 * state of the upstream sources — for load-balancer / readiness probes deciding
 * whether this instance should receive traffic. Returns `undefined` (a pure 204)
 * when there is no I/O to check.
 */
export const buildReadinessCallback = <C extends PylonHttpContext>(
  sources: Sources,
): PylonHttpCallback<C> | undefined => {
  if (!sources.bus && !sources.db) return undefined;

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
  sources: Sources,
): PylonHttpCallback<C> | undefined => {
  if (!sources.bus && !sources.db) return undefined;

  let healthy = false;

  return async () => {
    if (healthy) return;
    assertHealthy(await pingSources(sources));
    healthy = true;
  };
};
