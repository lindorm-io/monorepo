import { getUnixTime } from "date-fns";
import type { Expiry } from "../types/index.js";
import { expiresAt } from "./expires-at.js";

/**
 * Seconds from `from` until the given `Expiry`. Calendar-correct: resolves
 * via `expiresAt()` which honours real calendar months and years.
 */
export const expiresIn = (expiry: Expiry, from: Date = new Date()): number => {
  const unix = getUnixTime(from);
  const date = expiresAt(expiry, from);
  const expiresOn = getUnixTime(date);

  return expiresOn - unix;
};
