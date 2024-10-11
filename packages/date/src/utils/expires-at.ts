import { isDate, isString } from "@lindorm/is";
import { Expiry } from "../types";
import { addWithMilliseconds, assertExpiryDate, readableToDuration } from "./private";

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
