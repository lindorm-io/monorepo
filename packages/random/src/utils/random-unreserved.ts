import { createRandomString } from "./private";

export const randomUnreserved = (length: number): string =>
  createRandomString(length, {
    custom: "unreserved",
    numbersMax: "30%",
    symbolsMax: "10%",
  });
