import type { KeysInput } from "../../types/index.js";
import { capitalCase, convertArray, convertObject } from "../../internal/index.js";

export { capitalCase };

export const capitalKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, capitalCase);

export const capitalArray = (input: Array<string>): Array<string> =>
  convertArray(input, capitalCase);
