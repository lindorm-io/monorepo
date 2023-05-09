import { UNRESERVED_TOKEN_SYMBOLS } from "../constants";
import { RandomStringOptions } from "../types";
import { randomString } from "./random-string";

export const randomToken = (length: number, options: RandomStringOptions = {}): string =>
  randomString(length, {
    numbers: "random",
    symbols: "20%",
    custom: { symbols: UNRESERVED_TOKEN_SYMBOLS.join("") },
    ...options,
  });
