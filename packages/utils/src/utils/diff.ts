export const diff = (source: Array<any>, target: Array<any>): boolean => {
  const setA = new Set(source);
  return target.every((element) => setA.has(element));
};
