import type { KeysInput } from "../../types/index.js";
import { convertArray, convertObject, kebabCase } from "../../internal/index.js";

export { kebabCase };

export const kebabKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, kebabCase);

export const kebabArray = (input: Array<string>): Array<string> =>
  convertArray(input, kebabCase);
