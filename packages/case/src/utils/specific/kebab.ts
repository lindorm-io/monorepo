import type { KeysInput, KeysOptions } from "../../types/index.js";
import { convertArray, convertObject, kebabCase } from "../../internal/index.js";

export { kebabCase };

export const kebabKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, kebabCase, options);

export const kebabArray = (input: Array<string>): Array<string> =>
  convertArray(input, kebabCase);
