import { KeysInput } from "../../types";
import { convertArray, convertObject, pascalCase } from "../private";

export { pascalCase };

export const pascalKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, pascalCase);

export const pascalArray = (input: Array<string>): Array<string> =>
  convertArray(input, pascalCase);
