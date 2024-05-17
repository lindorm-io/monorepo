import { getUnixTime } from "date-fns";
import { Expiry } from "../types";
import { expiresAt } from "./expires-at";

export const expiresIn = (expiry: Expiry, from: Date = new Date()): number => {
  const unix = getUnixTime(from);
  const date = expiresAt(expiry, from);
  const expiresOn = getUnixTime(date);

  return expiresOn - unix;
};
