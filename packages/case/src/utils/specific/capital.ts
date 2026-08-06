import type { KeysInput, KeysOptions } from "../../types/index.js";
import { capitalCase, convertArray, convertObject } from "../../internal/index.js";

export { capitalCase };

export const capitalKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, capitalCase, options);

export const capitalArray = (input: Array<string>): Array<string> =>
  convertArray(input, capitalCase);
