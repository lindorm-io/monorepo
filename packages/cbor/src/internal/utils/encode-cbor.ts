import type { Dict } from "@lindorm/types";
import { encode } from "cbor2";
import type { CborEncodeOptions } from "../../types/cbor-field.js";
import type { ResolvedCborSpec } from "../types/resolved-cbor-spec.js";
import { encodeCborMap } from "./encode-cbor-map.js";

export const encodeCbor = (
  config: ResolvedCborSpec,
  value: Dict,
  options: CborEncodeOptions = {},
): Uint8Array => encode(encodeCborMap(config, value, options), { cde: true });
