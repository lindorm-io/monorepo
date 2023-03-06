import { randomString } from "./random-string";
import { UNRESERVED_TOKEN_SYMBOLS } from "../constants";

export const randomToken = (length: number): string =>
  randomString(length, {
    numbers: "random",
    symbols: "20%",
    custom: { symbols: UNRESERVED_TOKEN_SYMBOLS.join("") },
  });
