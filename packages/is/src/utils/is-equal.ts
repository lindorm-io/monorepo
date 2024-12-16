import { isArray } from "./is-array";
import { isBuffer } from "./is-buffer";
import { isDate } from "./is-date";
import { isError } from "./is-error";
import { isNaN } from "./is-nan";
import { isObject } from "./is-object";
import { isUrl } from "./is-url";

export const isEqual = (expect: any, actual: any, visited = new WeakMap()): boolean => {
  if (isNaN(expect) && isNaN(actual)) {
    return true; // Explicitly handle NaN
  }

  if (expect === actual) {
    return true;
  }

  if (typeof expect !== typeof actual) {
    return false;
  }

  if (expect === null || actual === null) {
    return false;
  }

  if (isDate(expect) && isDate(actual)) {
    return expect.getTime() === actual.getTime();
  }

  if (isError(expect) && isError(actual)) {
    return expect.name === actual.name && expect.message === actual.message;
  }

  if (isBuffer(expect) && isBuffer(actual)) {
    return expect.equals(actual);
  }

  if (isUrl(expect) && isUrl(actual)) {
    return expect.href === actual.href;
  }

  if (isArray(expect) && isArray(actual)) {
    if (expect.length !== actual.length) {
      return false;
    }
    for (let i = 0; i < expect.length; i++) {
      if (!isEqual(expect[i], actual[i], visited)) {
        return false;
      }
    }
    return true;
  }

  if (expect instanceof Set && actual instanceof Set) {
    if (expect.size !== actual.size) {
      return false;
    }
    for (const value of expect) {
      if (!Array.from(actual).some((a) => isEqual(value, a, visited))) {
        return false;
      }
    }
    return true;
  }

  if (expect instanceof Map && actual instanceof Map) {
    if (expect.size !== actual.size) {
      return false;
    }
    for (const [key, value] of expect) {
      if (!actual.has(key) || !isEqual(value, actual.get(key), visited)) {
        return false;
      }
    }
    return true;
  }

  if (isObject(expect) && isObject(actual)) {
    if (visited.has(expect)) {
      return visited.get(expect) === actual;
    }
    visited.set(expect, actual);

    const expectKeys = Object.keys(expect);
    const actualKeys = Object.keys(actual);

    if (expectKeys.length !== actualKeys.length) {
      return false;
    }

    for (const key of expectKeys) {
      if (!isEqual(expect[key], actual[key], visited)) {
        return false;
      }
    }

    return true;
  }

  return false;
};
