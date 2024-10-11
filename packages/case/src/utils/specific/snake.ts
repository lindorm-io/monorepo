import { KeysInput } from "../../types";
import { convertArray, convertObject, snakeCase } from "../private";

export { snakeCase };

export const snakeKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, snakeCase);

export const snakeArray = (input: Array<string>): Array<string> =>
  convertArray(input, snakeCase);
