export const pickFrom = <T>(pick: Array<T>, from: Array<T>): Array<T> =>
  pick.filter((x) => from.includes(x));
