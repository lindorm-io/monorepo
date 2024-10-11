import { KeysInput } from "../../types";
import { convertArray, convertObject, pathCase } from "../private";

export { pathCase };

export const pathKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, pathCase);

export const pathArray = (input: Array<string>): Array<string> =>
  convertArray(input, pathCase);
