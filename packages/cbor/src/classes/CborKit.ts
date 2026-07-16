import type { DeepPartial, Dict } from "@lindorm/types";
import type { ICborKit } from "../interfaces/CborKit.js";
import type { CborEncodeOptions, CborKitSettings } from "../types/cbor-field.js";
import type { ResolvedCborSpec } from "../internal/types/resolved-cbor-spec.js";
import { decodeCbor, encodeCbor, resolveCborSpec } from "../internal/index.js";

export class CborKit<T extends Dict = Dict> implements ICborKit<T> {
  private readonly config: ResolvedCborSpec;

  constructor(settings: CborKitSettings) {
    this.config = resolveCborSpec(settings);
  }

  encode(value: DeepPartial<T>, options: CborEncodeOptions = {}): Uint8Array {
    return encodeCbor(this.config, value, options.proprietary ?? true);
  }

  decode(bytes: Uint8Array): T {
    return decodeCbor(this.config, bytes) as T;
  }
}
