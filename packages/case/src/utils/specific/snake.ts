import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { snakeCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { snakeCase };

export const snakeKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, snakeCase);

export const snakeArray = (input: Array<string>): Array<string> => convertArray(input, snakeCase);
