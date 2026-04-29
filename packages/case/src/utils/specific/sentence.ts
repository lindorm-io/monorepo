import type { KeysInput } from "../../types/index.js";
import { convertArray, convertObject, sentenceCase } from "../../internal/index.js";

export { sentenceCase };

export const sentenceKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, sentenceCase);

export const sentenceArray = (input: Array<string>): Array<string> =>
  convertArray(input, sentenceCase);
