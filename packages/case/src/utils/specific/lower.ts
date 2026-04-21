import type { KeysInput } from "../../types/index.js";
import { convertArray, convertObject, lowerCase } from "../../internal/index.js";

export { lowerCase };

export const lowerKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, lowerCase);

export const lowerArray = (input: Array<string>): Array<string> =>
  convertArray(input, lowerCase);
