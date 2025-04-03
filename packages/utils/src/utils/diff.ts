import { isEqual } from "@lindorm/is";

export const diff = <T extends Array<any> = Array<any>>(
  source: Array<any>,
  target: T,
): T => target.filter((t) => !source.some((s) => isEqual(s, t))) as T;

export const diffAny = <T extends Array<any> = Array<any>>(
  source: Array<any>,
  target: T,
): T => [...diff(source, target), ...diff(target, source)] as T;
