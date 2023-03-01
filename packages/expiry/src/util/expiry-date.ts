import { Expiry } from "../types";
import { add, fromUnixTime } from "date-fns";
import { assertExpiryDate, assertSeconds } from "./private";
import { stringToDurationObject } from "./string-time";

export const expiryDate = (expiry: Expiry): Date => {
  if (typeof expiry === "string") {
    return add(new Date(), stringToDurationObject(expiry));
  }

  if (typeof expiry === "number") {
    assertSeconds(expiry);

    return fromUnixTime(expiry);
  }

  if (expiry instanceof Date) {
    assertExpiryDate(expiry);

    return expiry;
  }

  throw new Error("Invalid expiry: Expiry is not of type [ string | number | Date ]");
};
