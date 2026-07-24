import { captureOutput } from "./capture-output.js";

/**
 * How the compose file's published host ports relate to what is already bound:
 * - `none`    — the file publishes no ports, or none of them are bound → start fresh.
 * - `all`     — every published port is already served → attach (reuse, no teardown).
 * - `partial` — some but not all are bound → a genuine conflict `up` would fail on.
 */
export type ReuseStatus = "none" | "all" | "partial";

export interface ServiceInspection {
  /** The distinct host ports the compose file publishes. */
  required: Array<number>;
  /** Host port → the name of the running container currently publishing it. */
  bound: Map<number, string>;
  /** The required ports that are already bound (subset of `required`). */
  boundRequired: Array<number>;
  status: ReuseStatus;
}

// `published` in a resolved compose config is a number, a string ("5672"), or a
// range string ("5000-5005"). Expand to the concrete list of host ports.
const parsePublished = (value: unknown): Array<number> => {
  if (typeof value === "number") return [value];
  if (typeof value !== "string" || value === "") return [];

  const [lo, hi] = value.split("-").map((part) => parseInt(part, 10));
  if (Number.isNaN(lo)) return [];
  if (hi === undefined || Number.isNaN(hi)) return [lo];

  const ports: Array<number> = [];
  for (let port = lo; port <= hi; port++) ports.push(port);
  return ports;
};

// Resolve the compose file (includes and all) and collect every published host
// port. A failed/empty probe yields [] → the caller treats it as "start fresh".
const publishedPorts = async (file: string, project: string): Promise<Array<number>> => {
  const args = ["compose"];
  if (file) args.push("-f", file);
  if (project) args.push("-p", project);
  args.push("config", "--format", "json");

  const { code, stdout } = await captureOutput("docker", args);
  if (code !== 0 || !stdout.trim()) return [];

  let config: {
    services?: Record<string, { ports?: Array<{ published?: unknown }> }>;
  };
  try {
    config = JSON.parse(stdout);
  } catch {
    return [];
  }

  const ports = new Set<number>();
  for (const service of Object.values(config.services ?? {})) {
    for (const port of service.ports ?? []) {
      for (const value of parsePublished(port.published)) ports.add(value);
    }
  }

  return [...ports];
};

// Map every host port a running container currently publishes to that
// container's name. Docker prints publishings as `<ip>:<hostPort>-><cport>/proto`.
const boundPorts = async (): Promise<Map<number, string>> => {
  const { code, stdout } = await captureOutput("docker", [
    "ps",
    "--format",
    "{{.Names}}\t{{.Ports}}",
  ]);

  const bound = new Map<number, string>();
  if (code !== 0) return bound;

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const [name, portsField = ""] = line.split("\t");
    for (const match of portsField.matchAll(/:(\d+)->/g)) {
      const port = parseInt(match[1], 10);
      if (!bound.has(port)) bound.set(port, name);
    }
  }

  return bound;
};

/**
 * Inspect whether the compose file's services are already running, by comparing
 * the host ports it publishes against the ports running containers already hold.
 * Drives the `--reuse` decision in {@link composed}.
 */
export const inspectServices = async ({
  file,
  project,
}: {
  file: string;
  project: string;
}): Promise<ServiceInspection> => {
  const [required, bound] = await Promise.all([
    publishedPorts(file, project),
    boundPorts(),
  ]);

  const boundRequired = required.filter((port) => bound.has(port));

  const status: ReuseStatus =
    required.length === 0 || boundRequired.length === 0
      ? "none"
      : boundRequired.length === required.length
        ? "all"
        : "partial";

  return { required, bound, boundRequired, status };
};
