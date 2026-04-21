import { isArray, isObject, isString } from "@lindorm/is";
import type {
  PylonHttpContext,
  PylonHttpOptions,
  PylonHttpRouters,
} from "../../types/index.js";

export const normaliseRoutes = <C extends PylonHttpContext>(
  input: PylonHttpOptions<C>["routes"],
): Array<string | PylonHttpRouters<C>> => {
  if (input === undefined) return [];
  if (isArray<string | PylonHttpRouters<C>>(input)) return input;
  if (isString(input)) return [input];
  if (isObject(input)) return [input];
  return [];
};
