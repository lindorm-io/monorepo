import { createRandomString } from "./private/create-random-string";

export const randomSecret = (length: number): string =>
  createRandomString(length, {
    custom: "secret",
    numbersMax: "random",
    symbolsMax: "random",
  });
