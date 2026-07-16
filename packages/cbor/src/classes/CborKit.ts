import type { DeepPartial, Dict } from "@lindorm/types";
import type { ICborKit } from "../interfaces/CborKit.js";
import type { CborEncodeOptions, CborKitSettings } from "../types/cbor-field.js";
import type { ResolvedCborSpec } from "../internal/types/resolved-cbor-spec.js";
import {
  decodeCbor,
  decodeCborMap,
  encodeCbor,
  encodeCborMap,
  resolveCborSpec,
} from "../internal/index.js";

export class CborKit<T extends Dict = Dict> implements ICborKit<T> {
  private readonly config: ResolvedCborSpec;

  constructor(settings: CborKitSettings) {
    this.config = resolveCborSpec(settings);
  }

  // Default mode: object → serialized CBOR bytes.
  encode(value: DeepPartial<T>, options?: CborEncodeOptions): Uint8Array;
  // "map" mode: object → the intermediate wire map (caller owns serialization).
  encode(
    mode: "map",
    value: DeepPartial<T>,
    options?: CborEncodeOptions,
  ): Map<number | string, unknown>;
  encode(
    modeOrValue: "map" | DeepPartial<T>,
    valueOrOptions?: DeepPartial<T> | CborEncodeOptions,
    options?: CborEncodeOptions,
  ): Uint8Array | Map<number | string, unknown> {
    return modeOrValue === "map"
      ? encodeCborMap(this.config, valueOrOptions as DeepPartial<T>, options)
      : encodeCbor(this.config, modeOrValue, valueOrOptions as CborEncodeOptions);
  }

  // Default mode: serialized CBOR bytes → object.
  decode(bytes: Uint8Array): T;
  // "map" mode: a pre-decoded wire map → object (caller owns deserialization).
  decode(mode: "map", map: Map<number | string, unknown>): T;
  decode(bytesOrMode: Uint8Array | "map", map?: Map<number | string, unknown>): T {
    return (
      bytesOrMode === "map"
        ? decodeCborMap(this.config, map!)
        : decodeCbor(this.config, bytesOrMode)
    ) as T;
  }
}
