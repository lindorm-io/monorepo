import { Dict } from "@lindorm/types";

export const lazyFactory = <T>(on: Dict, key: string, factory: () => T): void => {
  let cached: T | undefined;
  Object.defineProperty(on, key, {
    get() {
      if (!cached) {
        cached = factory();
      }
      return cached;
    },
    configurable: true,
    enumerable: true,
  });
};
