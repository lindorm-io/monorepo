import { B64 } from "@lindorm/b64";
import { encode } from "cbor2";
import type { LindormJwk } from "../../../types/index.js";
import {
  CBOR_ALG,
  CBOR_CRV,
  CBOR_ENC,
  CBOR_KTY,
  CBOR_LABEL,
  CBOR_USE,
  CBOR_VERSION,
} from "../../constants/cbor-table.js";
import { CBOR_MATERIAL_KEYS } from "./cbor-material-keys.js";

// A Node Buffer carries a `toJSON` that cbor2 honours (encoding it as an object),
// so key material must be handed over as a plain Uint8Array to land as a byte
// string on the wire.
const bytesFromB64 = (text: string, encoding: "b64u" | "base64"): Uint8Array =>
  new Uint8Array(B64.toBuffer(text, encoding));

const setText = (map: Map<number, unknown>, label: number, value?: string): void => {
  if (typeof value === "string" && value.length > 0) map.set(label, value);
};

const setInt = (map: Map<number, unknown>, label: number, value?: number): void => {
  if (typeof value === "number") map.set(label, value);
};

// Encode a private LindormJwk into the kryptos CBOR wire map (integer labels,
// enum ints, byte strings for material). Deterministic (CDE) for stable output.
//
// `key_ops` (label 7) is NEVER encoded — `operations` is derived from the key
// material on import, so there is nothing to carry. The DECODE path still reads
// label 7, because env strings already in the wild carry it.
export const encodeCborEnv = (jwk: LindormJwk): Uint8Array => {
  const map = new Map<number, unknown>();

  map.set(CBOR_LABEL.version, CBOR_VERSION);
  map.set(CBOR_LABEL.kty, CBOR_KTY[jwk.kty]);
  map.set(CBOR_LABEL.kid, jwk.kid);
  map.set(CBOR_LABEL.alg, CBOR_ALG[jwk.alg]);
  map.set(CBOR_LABEL.use, CBOR_USE[jwk.use]);

  if (jwk.crv) map.set(CBOR_LABEL.crv, CBOR_CRV[jwk.crv]);
  if (jwk.enc) map.set(CBOR_LABEL.enc, CBOR_ENC[jwk.enc]);

  setInt(map, CBOR_LABEL.exp, jwk.exp);
  setInt(map, CBOR_LABEL.iat, jwk.iat);
  setInt(map, CBOR_LABEL.nbf, jwk.nbf);

  setText(map, CBOR_LABEL.iss, jwk.iss);
  setText(map, CBOR_LABEL.jku, jwk.jku);
  setText(map, CBOR_LABEL.purpose, jwk.purpose);
  setText(map, CBOR_LABEL.owner_id, jwk.owner_id);

  if (typeof jwk.hidden === "boolean") map.set(CBOR_LABEL.hidden, jwk.hidden);

  if (jwk.x5c && jwk.x5c.length > 0) {
    map.set(
      CBOR_LABEL.x5c,
      jwk.x5c.map((der) => bytesFromB64(der, "base64")),
    );
  }

  for (const key of CBOR_MATERIAL_KEYS) {
    const text = jwk[key];
    if (typeof text === "string" && text.length > 0) {
      map.set(CBOR_LABEL[key], bytesFromB64(text, "b64u"));
    }
  }

  return encode(map, { cde: true });
};
