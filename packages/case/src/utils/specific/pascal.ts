import type { KeysInput } from "../../types/index.js";
import { convertArray, convertObject, pascalCase } from "../../internal/index.js";

export { pascalCase };

export const pascalKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, pascalCase);

export const pascalArray = (input: Array<string>): Array<string> =>
  convertArray(input, pascalCase);
