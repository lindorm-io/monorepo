import { KeysInput } from "../../types";
import { capitalCase, convertArray, convertObject } from "../private";

export { capitalCase };

export const capitalKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, capitalCase);

export const capitalArray = (input: Array<string>): Array<string> =>
  convertArray(input, capitalCase);
