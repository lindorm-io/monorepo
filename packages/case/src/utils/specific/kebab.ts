import { KeysInput } from "../../types";
import { convertArray, convertObject, kebabCase } from "#internal/index";

export { kebabCase };

export const kebabKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, kebabCase);

export const kebabArray = (input: Array<string>): Array<string> =>
  convertArray(input, kebabCase);
