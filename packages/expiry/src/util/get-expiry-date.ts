import { Expiry } from "../types";
import { add, fromUnixTime, isAfter } from "date-fns";
import { stringToDurationObject } from "./string-time";

const assertSeconds = (number: number): void => {
  if (number < 9999999999) return;

  throw new Error("Invalid expiry: Expiry is not in seconds");
};

const assertExpiryDate = (date: Date): void => {
  if (isAfter(date, new Date())) return;

  throw new Error("Invalid expiry: Expiry is before current date");
};

const convertExpiryToDate = (expiry: Expiry): Date => {
  if (typeof expiry === "string") {
    return add(new Date(), stringToDurationObject(expiry));
  }

  if (typeof expiry === "number") {
    assertSeconds(expiry);
    return fromUnixTime(expiry);
  }

  if (expiry instanceof Date) {
    return expiry;
  }

  throw new Error("Invalid expiry: Expiry is not of type [ string | number | Date ]");
};

export const getExpiryDate = (expiry: Expiry): Date => {
  const date = convertExpiryToDate(expiry);

  assertExpiryDate(date);

  return date;
};

export const expiryDate = getExpiryDate;
