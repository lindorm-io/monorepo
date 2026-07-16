import type { DeepPartial, Dict } from "@lindorm/types";
import type { CborEncodeOptions } from "../types/cbor-field.js";

export interface ICborKit<T extends Dict = Dict> {
  encode(value: DeepPartial<T>, options?: CborEncodeOptions): Uint8Array;
  encode(
    mode: "map",
    value: DeepPartial<T>,
    options?: CborEncodeOptions,
  ): Map<number | string, unknown>;
  decode(bytes: Uint8Array): T;
  decode(mode: "map", map: Map<number | string, unknown>): T;
}
