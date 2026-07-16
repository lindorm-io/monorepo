import type { Dict } from "@lindorm/types";
import { decode } from "cbor2";
import type { ResolvedCborSpec } from "../types/resolved-cbor-spec.js";
import { decodeCborMap } from "./decode-cbor-map.js";

export const decodeCbor = (config: ResolvedCborSpec, bytes: Uint8Array): Dict =>
  decodeCborMap(
    config,
    decode<Map<number | string, unknown>>(bytes, { preferMap: true }),
  );
