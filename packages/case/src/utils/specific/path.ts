import type { KeysInput, KeysOptions } from "../../types/index.js";
import { convertArray, convertObject, pathCase } from "../../internal/index.js";

export { pathCase };

export const pathKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, pathCase, options);

export const pathArray = (input: Array<string>): Array<string> =>
  convertArray(input, pathCase);
