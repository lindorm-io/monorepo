import { DateError } from "../error";
import { Expiry } from "../types";
import { add, fromUnixTime, isAfter, isDate } from "date-fns";
import { isNumber, isString } from "lodash";
import { stringToDurationObject } from "./string-time";

const assertSeconds = (number: number): void => {
  if (number < 9999999999) return;

  throw new DateError("Invalid expiry", {
    debug: { number },
    description: "Expiry is not in seconds",
  });
};

const assertExpiryDate = (date: Date): void => {
  if (isAfter(date, new Date())) return;

  throw new DateError("Invalid expiry", {
    debug: { date },
    description: "Expiry is before current date",
  });
};

const convertExpiryToDate = (expiry: Expiry): Date => {
  if (isString(expiry)) {
    return add(new Date(), stringToDurationObject(expiry));
  }

  if (isNumber(expiry)) {
    assertSeconds(expiry);
    return fromUnixTime(expiry);
  }

  if (isDate(expiry)) {
    return expiry;
  }

  throw new DateError("Invalid expiry", {
    debug: { expiry },
    description: "Expiry is not of type [ string | number | Date ]",
  });
};

export const getExpiryDate = (expiry: Expiry): Date => {
  const date = convertExpiryToDate(expiry);

  assertExpiryDate(date);

  return date;
};

export const expiryDate = getExpiryDate;
