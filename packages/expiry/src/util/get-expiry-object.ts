import { Expiry } from "../types";
import { getExpiryDate } from "./get-expiry-date";
import { getUnixTime } from "date-fns";

interface Result {
  expires: Date;
  expiresIn: number;
  expiresUnix: number;
  now: Date;
  nowUnix: number;
}

export const getExpiryObject = (expiry: Expiry): Result => {
  const now = new Date();
  const nowUnix = getUnixTime(now);
  const expires = getExpiryDate(expiry);
  const expiresUnix = getUnixTime(expires);
  const expiresIn = expiresUnix - nowUnix;

  return {
    expires,
    expiresIn,
    expiresUnix,
    now,
    nowUnix,
  };
};

export const expiryObject = getExpiryObject;
