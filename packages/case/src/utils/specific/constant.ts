import type { KeysInput, KeysOptions } from "../../types/index.js";
import { constantCase, convertArray, convertObject } from "../../internal/index.js";

export { constantCase };

export const constantKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, constantCase, options);

export const constantArray = (input: Array<string>): Array<string> =>
  convertArray(input, constantCase);
