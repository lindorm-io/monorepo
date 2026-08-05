import { isLive } from "../../utils/is-live.js";

export const assertExpiryDate = (date: Date, from: Date = new Date()): void => {
  if (isLive(date, from)) return;

  throw new Error("Invalid expiry: Expiry is before current date");
};
