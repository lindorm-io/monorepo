import { isArray, isEqual, isObject } from "@lindorm/is";
import { DeepPartial, Dict } from "@lindorm/types";

export const diffArray = <T extends Array<any> = Array<any>>(
  source: Array<any>,
  target: T,
): T => target.filter((t) => !source.some((s) => isEqual(s, t))) as T;

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
      patch[key] = tVal;
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

    patch[key] = tVal;
  }

  return patch;
};

export function diff<T extends Dict>(source: Dict, target: T): DeepPartial<T>;
export function diff<T extends Array<any>>(source: Array<any>, target: T): T;
export function diff<T extends Dict | Array<any>>(
  source: Dict | Array<any>,
  target: T,
): DeepPartial<T> {
  if (isArray(source) && isArray(target)) {
    return diffArray(source, target) as DeepPartial<T>;
  }
  if (isObject(source) && isObject(target)) {
    return diffObject(source as Dict, target as DeepPartial<T>);
  }
  throw new TypeError("Source and target must be of the same type (array or object)");
}

export const diffAny = <T extends Array<any> = Array<any>>(
  source: Array<any>,
  target: T,
): T => [...diff(source, target), ...diff(target, source)] as T;
