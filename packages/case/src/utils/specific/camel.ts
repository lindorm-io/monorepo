import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { camelCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { camelCase };

export const camelKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, camelCase);

export const camelArray = (input: Array<string>): Array<string> => convertArray(input, camelCase);
