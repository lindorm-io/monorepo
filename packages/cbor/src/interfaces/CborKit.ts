import type { DeepPartial, Dict } from "@lindorm/types";

export interface ICborKit<T extends Dict = Dict> {
  encode(value: DeepPartial<T>): Uint8Array;
  decode(bytes: Uint8Array): T;
}
