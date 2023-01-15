import { isAfter } from "date-fns";

export const assertExpiryDate = (date: Date): void => {
  if (isAfter(date, new Date())) return;

  throw new Error("Invalid expiry: Expiry is before current date");
};
