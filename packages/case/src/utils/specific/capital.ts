import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { capitalCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { capitalCase };

export const capitalKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, capitalCase);

export const capitalArray = (input: Array<string>): Array<string> =>
  convertArray(input, capitalCase);
