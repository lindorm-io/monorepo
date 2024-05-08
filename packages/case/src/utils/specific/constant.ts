import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { constantCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { constantCase };

export const constantKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, constantCase);

export const constantArray = (input: Array<string>): Array<string> =>
  convertArray(input, constantCase);
