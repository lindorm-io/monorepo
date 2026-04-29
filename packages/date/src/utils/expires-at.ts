import { isDate, isString } from "@lindorm/is";
import type { Expiry } from "../types/index.js";
import {
  addWithMilliseconds,
  assertExpiryDate,
  readableToDuration,
} from "../internal/utils/index.js";

/**
 * Resolve an `Expiry` to an absolute `Date`. Calendar-correct via date-fns
 * for year/month units (uses `add()`, not millisecond estimation).
 */
export const expiresAt = (expiry: Expiry, from: Date = new Date()): Date => {
  if (isString(expiry)) {
    return addWithMilliseconds(from, readableToDuration(expiry));
  }

  if (isDate(expiry)) {
    assertExpiryDate(expiry);

    return expiry;
  }

  throw new Error("Invalid expiry: Expiry is not of type [ string | Date ]");
};
