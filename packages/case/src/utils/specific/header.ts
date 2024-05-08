import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { headerCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { headerCase };

export const headerKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, headerCase);

export const headerArray = (input: Array<string>): Array<string> => convertArray(input, headerCase);
