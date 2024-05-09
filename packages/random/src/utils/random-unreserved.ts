import { _createRandomString } from "./private/create-random-string";

export const randomUnreserved = (length: number): string =>
  _createRandomString(length, {
    numbersMax: "30%",
    symbolsMax: "10%",
    customSymbols: "unreserved",
  });
