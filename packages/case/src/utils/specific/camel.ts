import type { KeysInput, KeysOptions } from "../../types/index.js";
import { camelCase, convertArray, convertObject } from "../../internal/index.js";

export { camelCase };

export const camelKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, camelCase, options);

export const camelArray = (input: Array<string>): Array<string> =>
  convertArray(input, camelCase);
