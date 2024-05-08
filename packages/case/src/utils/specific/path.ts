import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { pathCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { pathCase };

export const pathKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, pathCase);

export const pathArray = (input: Array<string>): Array<string> => convertArray(input, pathCase);
