import { KeysInput } from "../../types";
import { convertArray, convertObject, headerCase } from "../private";

export { headerCase };

export const headerKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, headerCase);

export const headerArray = (input: Array<string>): Array<string> =>
  convertArray(input, headerCase);
