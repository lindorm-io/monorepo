import { getUnixTime } from "date-fns";
import { Expiry } from "../types";
import { expiresAt } from "./expires-at";

type Result = {
  expiresAt: Date;
  expiresIn: number;
  expiresUnix: number;
  from: Date;
  fromUnix: number;
};

export const expires = (expiry: Expiry, from: Date = new Date()): Result => {
  const fromUnix = getUnixTime(from);
  const date = expiresAt(expiry);
  const expiresUnix = getUnixTime(date);
  const expiresIn = expiresUnix - fromUnix;

  return {
    expiresAt: date,
    expiresIn,
    expiresUnix,
    from,
    fromUnix,
  };
};
