import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { pascalCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { pascalCase };

export const pascalKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, pascalCase);

export const pascalArray = (input: Array<string>): Array<string> => convertArray(input, pascalCase);
