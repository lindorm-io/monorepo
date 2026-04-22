import type { AbortReason } from "@lindorm/types";

export const isAbortReason = (value: unknown): value is AbortReason => {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === "client-disconnect" ||
    kind === "request-timeout" ||
    kind === "server-shutdown" ||
    kind === "parent-aborted" ||
    kind === "rate-limit-exceeded" ||
    kind === "breaker-open" ||
    kind === "manual"
  );
};
