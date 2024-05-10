import { _createRandomString } from "./private/create-random-string";

export const randomSecret = (length: number): string =>
  _createRandomString(length, {
    custom: "secret",
    numbersMax: "random",
    symbolsMax: "random",
  });
