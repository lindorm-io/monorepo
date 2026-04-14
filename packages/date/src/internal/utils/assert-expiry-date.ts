import { isAfter } from "date-fns";

export const assertExpiryDate = (date: Date, from: Date = new Date()): void => {
  if (isAfter(date, from)) return;

  throw new Error("Invalid expiry: Expiry is before current date");
};
