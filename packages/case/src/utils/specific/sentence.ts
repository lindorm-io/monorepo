import { KeysInput } from "../../types";
import { convertArray } from "../private";
import { sentenceCase } from "../private/convert-case";
import { convertObject } from "../private/convert-object";

export { sentenceCase };

export const sentenceKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, sentenceCase);

export const sentenceArray = (input: Array<string>): Array<string> =>
  convertArray(input, sentenceCase);
