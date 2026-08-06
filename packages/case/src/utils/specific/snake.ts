import type { KeysInput, KeysOptions } from "../../types/index.js";
import { convertArray, convertObject, snakeCase } from "../../internal/index.js";

export { snakeCase };

export const snakeKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, snakeCase, options);

export const snakeArray = (input: Array<string>): Array<string> =>
  convertArray(input, snakeCase);
