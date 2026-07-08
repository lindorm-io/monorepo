import { Cron } from "croner";

/**
 * Resolve the next fire time for a standard cron `expression` strictly after
 * `from`, evaluated in `timezone` (IANA name, defaults to `"UTC"`). Returns
 * `null` when the expression has no future match. Assumes a valid expression —
 * guard with {@link isCron} first; an invalid pattern throws.
 */
export const cronNext = (expression: string, from: Date, timezone = "UTC"): Date | null =>
  new Cron(expression, { timezone }).nextRun(from);
