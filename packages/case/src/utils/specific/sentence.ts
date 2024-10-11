import { KeysInput } from "../../types";
import { convertArray, convertObject, sentenceCase } from "../private";

export { sentenceCase };

export const sentenceKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, sentenceCase);

export const sentenceArray = (input: Array<string>): Array<string> =>
  convertArray(input, sentenceCase);
