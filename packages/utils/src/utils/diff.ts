export const diff = <T extends Array<any> = Array<any>>(
  source: Array<any>,
  target: T,
): T => {
  const set = new Set(source);
  return target.filter((element) => !set.has(element)) as T;
};

export const diffAny = <T extends Array<any> = Array<any>>(
  source: Array<any>,
  target: T,
): T => [...diff(source, target), ...diff(target, source)] as T;
