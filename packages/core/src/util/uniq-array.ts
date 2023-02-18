export const uniqArray = <T extends any[] = any[]>(...args: any[] | any[][]): T =>
  [...new Set([...args.flat()].flat())].flat().sort() as T;
