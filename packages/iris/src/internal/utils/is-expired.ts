import type { IrisEnvelope } from "../types/iris-envelope";

export const isExpired = (
  envelope: Pick<IrisEnvelope, "expiry" | "timestamp">,
): boolean => {
  if (envelope.expiry === null) return false;
  return Date.now() - envelope.timestamp > envelope.expiry;
};
