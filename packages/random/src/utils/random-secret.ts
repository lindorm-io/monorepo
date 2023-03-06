import { randomString } from "./random-string";

export const randomSecret = (length: number): string =>
  randomString(length, {
    numbers: "random",
    symbols: "20%",
  });
