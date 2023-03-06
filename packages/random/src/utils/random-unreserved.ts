import { randomString } from "./random-string";
import { UNRESERVED_URL_SYMBOLS } from "../constants";

export const randomUnreserved = (length: number): string =>
  randomString(length, {
    numbers: "random",
    symbols: "20%",
    custom: { symbols: UNRESERVED_URL_SYMBOLS.join("") },
  });
