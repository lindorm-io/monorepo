import { KeysInput } from "../../types";
import { convertArray, convertObject, lowerCase } from "#internal/index";

export { lowerCase };

export const lowerKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, lowerCase);

export const lowerArray = (input: Array<string>): Array<string> =>
  convertArray(input, lowerCase);
