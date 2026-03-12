export const uniq = <T = any>(array: Array<any>): Array<T> =>
  [...new Set(array)] as Array<T>;

export const uniqFlat = <T = any>(
  ...args:
    | Array<any>
    | Array<Array<any>>
    | Array<Array<Array<any>>>
    | Array<Array<Array<Array<any>>>>
): Array<T> => [...new Set([...args.flat().flat().flat().flat().flat()])] as Array<T>;
