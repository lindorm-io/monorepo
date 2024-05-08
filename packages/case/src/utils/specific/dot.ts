import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { dotCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { dotCase };

export const dotKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, dotCase);

export const dotArray = (input: Array<string>): Array<string> => convertArray(input, dotCase);
