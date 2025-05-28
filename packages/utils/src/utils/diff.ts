import { isEqual, isObject } from "@lindorm/is";
import { DeepPartial, Dict } from "@lindorm/types";

export const diff = <T extends Array<any> = Array<any>>(
  source: Array<any>,
  target: T,
): T => target.filter((t) => !source.some((s) => isEqual(s, t))) as T;

export const diffAny = <T extends Array<any> = Array<any>>(
  source: Array<any>,
  target: T,
): T => [...diff(source, target), ...diff(target, source)] as T;

export const diffObject = <T extends Dict = Dict>(
  source: Dict,
  target: DeepPartial<T>,
  visited: WeakMap<any, any> = new WeakMap(),
): DeepPartial<T> => {
  if (visited.has(source)) return {};

  visited.set(source, target);

  const patch: Dict = {};
  const srcKeys = source ? Object.keys(source) : [];
  const tgtKeys = target ? Object.keys(target) : [];
  const allKeys = new Set([...srcKeys, ...tgtKeys]);

  for (const key of allKeys) {
    const inSrc = Object.prototype.hasOwnProperty.call(source, key);
    const inTgt = Object.prototype.hasOwnProperty.call(target, key);
    const sVal = (source as any)[key];
    const tVal = (target as any)[key];

    if (inSrc && !inTgt) {
      patch[key] = undefined as any;
      continue;
    }

    if (!inSrc && inTgt) {
      patch[key] = tVal as any;
      continue;
    }

    if (isEqual(sVal, tVal)) {
      continue;
    }

    if (isObject(sVal) && isObject(tVal)) {
      const nested = diffObject(sVal as any, tVal as any, visited);
      if (Object.keys(nested).length > 0) {
        patch[key] = nested as any;
      }
      continue;
    }

    patch[key] = tVal as any;
  }

  return patch;
};
