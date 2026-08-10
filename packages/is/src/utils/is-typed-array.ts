import { isDataView } from "./is-data-view.js";

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

// `ArrayBuffer.isView` is true for every typed array AND for `DataView`, which
// is the only non-typed view. Buffer IS a Uint8Array, so it matches too.
export const isTypedArray = (input: any): input is TypedArray =>
  Boolean(input) && ArrayBuffer.isView(input) && !isDataView(input);
