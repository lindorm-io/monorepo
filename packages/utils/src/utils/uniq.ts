export const uniq = <T extends Array<any> = Array<any>>(...args: Array<any>): T =>
  [...new Set([...args])].sort() as T;

export const uniqFlat = <T extends Array<any> = Array<any>>(
  ...args:
    | Array<any>
    | Array<Array<any>>
    | Array<Array<Array<any>>>
    | Array<Array<Array<Array<any>>>>
): T => [...new Set([...args.flat().flat().flat().flat().flat()])].sort() as T;
