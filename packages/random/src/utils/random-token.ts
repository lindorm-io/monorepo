import { createRandomString } from "./private/create-random-string";

export const randomToken = (length: number): string =>
  createRandomString(length, {
    custom: "token",
    numbersMax: "30%",
    symbolsMax: "10%",
  });
