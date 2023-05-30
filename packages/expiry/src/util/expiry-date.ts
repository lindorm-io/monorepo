import { add, addMilliseconds, fromUnixTime } from "date-fns";
import { Expiry } from "../types";
import { assertExpiryDate, assertSeconds } from "./private";
import { stringDuration } from "./string-time";

export const expiryDate = (expiry: Expiry): Date => {
  if (typeof expiry === "string") {
    const duration = stringDuration(expiry);
    const date = add(new Date(), duration);

    if (!duration.milliseconds) {
      return date;
    }

    return addMilliseconds(date, duration.milliseconds);
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
