import type { KeysInput } from "../../types/index.js";
import { camelCase, convertArray, convertObject } from "../../internal/index.js";

export { camelCase };

export const camelKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, camelCase);

export const camelArray = (input: Array<string>): Array<string> =>
  convertArray(input, camelCase);
