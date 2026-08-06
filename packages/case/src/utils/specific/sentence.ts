import type { KeysInput, KeysOptions } from "../../types/index.js";
import { convertArray, convertObject, sentenceCase } from "../../internal/index.js";

export { sentenceCase };

export const sentenceKeys = <T extends KeysInput = KeysInput>(
  input: T,
  options?: KeysOptions,
): T => convertObject(input, sentenceCase, options);

export const sentenceArray = (input: Array<string>): Array<string> =>
  convertArray(input, sentenceCase);
