import { CborKit } from "@lindorm/cbor";
import type { CborSpec } from "@lindorm/cbor";
import type { LindormJwk } from "../../types/index.js";
import { CBOR_MATERIAL_KEYS } from "../utils/cbor/cbor-material-keys.js";
import {
  CBOR_ALG,
  CBOR_CRV,
  CBOR_ENC,
  CBOR_KTY,
  CBOR_LABEL,
  CBOR_USE,
  CBOR_VERSION,
} from "./cbor-table.js";

// The kryptos CBOR env format expressed as a declarative `CborSpec` for
// `@lindorm/cbor`. It replaces the hand-rolled encode/decode engine while keeping
// the wire BYTE-IDENTICAL: the labels are the exact `CBOR_LABEL` integers, the
// enums are the exact value-tables, and the codec encodes with cbor2 `{ cde: true }`
// (deterministic key order) — the same engine the old code used.
//
// Present-only encoding, byte strings for material (b64u) and DER certs (base64),
// and integer scalars for the timestamps all match the previous behaviour
// field-for-field. Label 7 (the retired `key_ops`) has no field: it is never
// encoded, and the decoder rejects it as an unknown label (see decode-cbor-env).
export const CBOR_ENV_SPEC: CborSpec = {
  version: { label: CBOR_LABEL.version, value: CBOR_VERSION },
  fields: [
    { key: "kty", label: CBOR_LABEL.kty, kind: "enum", enum: CBOR_KTY },
    { key: "kid", label: CBOR_LABEL.kid, kind: "text" },
    { key: "alg", label: CBOR_LABEL.alg, kind: "enum", enum: CBOR_ALG },
    { key: "use", label: CBOR_LABEL.use, kind: "enum", enum: CBOR_USE },
    { key: "crv", label: CBOR_LABEL.crv, kind: "enum", enum: CBOR_CRV },
    { key: "enc", label: CBOR_LABEL.enc, kind: "enum", enum: CBOR_ENC },
    { key: "exp", label: CBOR_LABEL.exp, kind: "int" },
    { key: "iat", label: CBOR_LABEL.iat, kind: "int" },
    { key: "nbf", label: CBOR_LABEL.nbf, kind: "int" },
    { key: "iss", label: CBOR_LABEL.iss, kind: "text" },
    { key: "jku", label: CBOR_LABEL.jku, kind: "text" },
    { key: "purpose", label: CBOR_LABEL.purpose, kind: "text" },
    { key: "publish", label: CBOR_LABEL.publish, kind: "bool" },
    { key: "owner_id", label: CBOR_LABEL.owner_id, kind: "text" },
    { key: "x5c", label: CBOR_LABEL.x5c, kind: "bstrArray", encoding: "base64" },
    ...CBOR_MATERIAL_KEYS.map((key) => ({
      key,
      label: CBOR_LABEL[key],
      kind: "bstr" as const,
      encoding: "b64u" as const,
    })),
  ],
};

// One shared codec instance, built once from the spec, used by both the encode and
// decode paths. Typed to LindormJwk so the domain surface stays checked.
export const CBOR_ENV_KIT = new CborKit<LindormJwk>(CBOR_ENV_SPEC);
