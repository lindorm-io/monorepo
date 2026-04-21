import type { KeysInput } from "../../types/index.js";
import { convertArray, convertObject, snakeCase } from "../../internal/index.js";

export { snakeCase };

export const snakeKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, snakeCase);

export const snakeArray = (input: Array<string>): Array<string> =>
  convertArray(input, snakeCase);
