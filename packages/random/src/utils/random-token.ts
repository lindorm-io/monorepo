import { TOKEN_SYMBOLS } from "../constants";
import { RandomStringOptions } from "../types";
import { randomString } from "./random-string";

export const randomToken = (length: number, options: RandomStringOptions = {}): string =>
  randomString(length, {
    numbers: "random",
    symbols: "10%",
    custom: { symbols: TOKEN_SYMBOLS },
    ...options,
  });
