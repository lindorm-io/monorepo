export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type XOR<T, U> = T | U extends Record<string, any>
  ? (Without<T, U> & U) | (Without<U, T> & T)
  : T | U;
