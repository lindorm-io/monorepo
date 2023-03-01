export const uniqArray = <T = any>(...args: Array<any> | Array<Array<any>>): Array<T> =>
  [...new Set([...args.flat().flat().flat()])].sort() as Array<T>;
