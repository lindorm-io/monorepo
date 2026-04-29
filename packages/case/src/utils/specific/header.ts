import type { KeysInput } from "../../types/index.js";
import { convertArray, convertObject, headerCase } from "../../internal/index.js";

export { headerCase };

export const headerKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, headerCase);

export const headerArray = (input: Array<string>): Array<string> =>
  convertArray(input, headerCase);
