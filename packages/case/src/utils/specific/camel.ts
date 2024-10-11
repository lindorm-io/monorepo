import { KeysInput } from "../../types";
import { camelCase, convertArray, convertObject } from "../private";

export { camelCase };

export const camelKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, camelCase);

export const camelArray = (input: Array<string>): Array<string> =>
  convertArray(input, camelCase);
