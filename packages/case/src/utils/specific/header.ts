import type { KeysInput, KeysOptions } from "../../types/index.js";
import { convertArray, convertObject, headerCase } from "../../internal/index.js";

export { headerCase };

export const headerKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, headerCase, options);

export const headerArray = (input: Array<string>): Array<string> =>
  convertArray(input, headerCase);
