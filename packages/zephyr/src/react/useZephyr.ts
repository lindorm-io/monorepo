import type { IZephyr } from "../interfaces/Zephyr";
import { ZephyrEventMap } from "../types";
import { useZephyrContext } from "./ZephyrProvider";

export const useZephyr = <E extends ZephyrEventMap = ZephyrEventMap>(): IZephyr<E> => {
  const { client } = useZephyrContext();
  return client;
};
