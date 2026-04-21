import { getUnixTime } from "date-fns";
import type { Expiry } from "../types/index.js";
import { expiresAt } from "./expires-at.js";

type Result = {
  expiresAt: Date;
  expiresIn: number;
  expiresOn: number;
  from: Date;
  fromUnix: number;
};

/**
 * Full expiry bundle: `expiresAt`, `expiresIn`, `expiresOn`, `from`,
 * `fromUnix`. Calendar-correct for year/month units via `expiresAt()`.
 */
export const expires = (expiry: Expiry, from: Date = new Date()): Result => {
  const fromUnix = getUnixTime(from);
  const date = expiresAt(expiry);
  const expiresOn = getUnixTime(date);
  const expiresIn = expiresOn - fromUnix;

  return {
    expiresAt: date,
    expiresIn,
    expiresOn,
    from,
    fromUnix,
  };
};
