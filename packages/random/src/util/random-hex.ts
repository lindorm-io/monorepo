import { randomString } from "./random-string";

export const randomHex = (length: number): string =>
  randomString(length, {
    numbers: "random",
  });
