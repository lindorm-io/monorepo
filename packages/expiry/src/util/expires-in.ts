import { Expiry } from "../types";
import { getUnixTime } from "date-fns";
import { expiryDate } from "./expiry-date";

export const expiresIn = (expiry: Expiry): number => {
  const now = new Date();
  const nowUnix = getUnixTime(now);
  const expires = expiryDate(expiry);
  const expiresUnix = getUnixTime(expires);

  return expiresUnix - nowUnix;
};
