import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { kebabCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { kebabCase };

export const kebabKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, kebabCase);

export const kebabArray = (input: Array<string>): Array<string> => convertArray(input, kebabCase);
