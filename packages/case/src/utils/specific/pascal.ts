import type { KeysInput, KeysOptions } from "../../types/index.js";
import { convertArray, convertObject, pascalCase } from "../../internal/index.js";

export { pascalCase };

export const pascalKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, pascalCase, options);

export const pascalArray = (input: Array<string>): Array<string> =>
  convertArray(input, pascalCase);
