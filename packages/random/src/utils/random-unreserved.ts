import { _createRandomString } from "./private/create-random-string";

export const randomUnreserved = (length: number): string =>
  _createRandomString(length, {
    custom: "unreserved",
    numbersMax: "30%",
    symbolsMax: "10%",
  });
