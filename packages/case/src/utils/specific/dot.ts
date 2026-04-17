import { KeysInput } from "../../types";
import { convertArray, convertObject, dotCase } from "../../internal/index";

export { dotCase };

export const dotKeys = <T extends KeysInput = KeysInput>(input: T): T =>
  convertObject(input, dotCase);

export const dotArray = (input: Array<string>): Array<string> =>
  convertArray(input, dotCase);
