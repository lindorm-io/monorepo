import type { IZephyr } from "../interfaces/Zephyr.js";
import type { ZephyrEventMap } from "../types/index.js";
import { useZephyrContext } from "./ZephyrProvider.js";

export const useZephyr = <E extends ZephyrEventMap = ZephyrEventMap>(): IZephyr<E> => {
  const { client } = useZephyrContext();
  return client;
};
