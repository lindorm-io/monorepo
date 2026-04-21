import { isArray, isString } from "@lindorm/is";
import { PylonListener } from "../../classes/PylonListener.js";
import type { PylonSocketContext, PylonSocketOptions } from "../../types/index.js";

export const normaliseListeners = <T extends PylonSocketContext>(
  input: PylonSocketOptions<T>["listeners"],
): Array<string | PylonListener<T>> => {
  if (input === undefined) return [];
  if (isArray<string | PylonListener<T>>(input)) return input;
  if (isString(input)) return [input];
  if (input instanceof PylonListener) return [input];
  return [];
};
