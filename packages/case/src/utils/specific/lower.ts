import type { KeysInput, KeysOptions } from "../../types/index.js";
import { convertArray, convertObject, lowerCase } from "../../internal/index.js";

export { lowerCase };

export const lowerKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, lowerCase, options);

export const lowerArray = (input: Array<string>): Array<string> =>
  convertArray(input, lowerCase);
