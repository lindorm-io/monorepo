import { createRandomString } from "./private";

export const randomSecret = (length: number): string =>
  createRandomString(length, {
    custom: "secret",
    numbersMax: "random",
    symbolsMax: "random",
  });
