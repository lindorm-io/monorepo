import type { KeysInput, KeysOptions } from "../../types/index.js";
import { convertArray, convertObject, dotCase } from "../../internal/index.js";

export { dotCase };

export const dotKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, dotCase, options);

export const dotArray = (input: Array<string>): Array<string> =>
  convertArray(input, dotCase);
