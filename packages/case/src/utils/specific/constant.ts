import { KeysInput } from "../../types";
import { constantCase, convertArray, convertObject } from "../private";

export { constantCase };

export const constantKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, constantCase);

export const constantArray = (input: Array<string>): Array<string> =>
  convertArray(input, constantCase);
