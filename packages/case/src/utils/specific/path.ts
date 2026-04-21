import type { KeysInput } from "../../types/index.js";
import { convertArray, convertObject, pathCase } from "../../internal/index.js";

export { pathCase };

export const pathKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, pathCase);

export const pathArray = (input: Array<string>): Array<string> =>
  convertArray(input, pathCase);
