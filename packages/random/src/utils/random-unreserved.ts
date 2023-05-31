import { UNRESERVED_URL_SYMBOLS } from "../constants";
import { randomString } from "./random-string";

export const randomUnreserved = (length: number): string =>
  randomString(length, {
    numbers: "random",
    symbols: "random",
    custom: { symbols: UNRESERVED_URL_SYMBOLS },
  });
