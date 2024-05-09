import { isDate, isString } from "@lindorm/is";
import { Expiry } from "../types";
import { _addWithMilliseconds } from "./private/add-with-milliseconds";
import { _assertExpiryDate } from "./private/assert-expiry-date";
import { _readableToDuration } from "./private/readable-to-duration";

export const expiresAt = (expiry: Expiry, from: Date = new Date()): Date => {
  if (isString(expiry)) {
    return _addWithMilliseconds(from, _readableToDuration(expiry));
  }

  if (isDate(expiry)) {
    _assertExpiryDate(expiry);

    return expiry;
  }

  throw new Error("Invalid expiry: Expiry is not of type [ string | Date ]");
};
