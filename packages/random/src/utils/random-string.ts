import { createRandomString } from "./private";

type Options = {
  numbers?: number;
  symbols?: number;
};

export const randomString = (length: number, options: Options = {}): string =>
  createRandomString(length, options.numbers ?? 0, options.symbols ?? 0);
