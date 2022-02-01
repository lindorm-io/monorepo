export interface AuthorizationHeader {
  type: string;
  value: string;
}

export type RecordAny = Record<string, any>;
export type RecordNever = Record<string, never>;
export type RecordNumber = Record<string, number>;
export type RecordString = Record<string, any>;
export type RecordUnknown = Record<string, unknown>;

export type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
export type XOR<T, U> = T | U extends RecordAny ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;
