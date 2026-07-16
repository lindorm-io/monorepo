import { CborKit } from "@lindorm/cbor";
import type { CborSpec } from "@lindorm/cbor";
import type { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { AesContentType } from "../../types/content.js";
import type { PublicEncryptionJwk } from "../../types/types.js";
import {
  AES_CBOR_ALG,
  AES_CBOR_CTY,
  AES_CBOR_ENC,
  AES_CBOR_LABEL,
  AES_CBOR_VERSION,
} from "./cbor-table.js";

// The self-contained AES CBOR record: header metadata AND cryptographic material
// live in ONE map — there is no separate header blob. The map IS the wire format
// carried by the `aes:`-prefixed string (base64url of these bytes).
export type AesCborRecord = {
  keyId: string;
  algorithm: KryptosAlgorithm;
  encryption: KryptosEncryption;
  contentType: AesContentType;
  initialisationVector: Buffer;
  authTag: Buffer;
  content: Buffer;
  publicEncryptionKey?: Buffer;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionTag?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
};

// The ephemeral public key (ECDH-ES family) is a small JWK — encoded as a
// self-describing text-keyed sub-map so it round-trips deterministically without
// its own label vocabulary. Only the four public members ever appear.
const EPK_KEYS = ["kty", "crv", "x", "y"] as const;

const encodeEpk = (value: unknown): Record<string, string> => {
  const jwk = value as PublicEncryptionJwk;
  const out: Record<string, string> = {};
  for (const key of EPK_KEYS) {
    const member = jwk[key];
    if (member !== undefined) out[key] = member;
  }
  return out;
};

const decodeEpk = (wire: unknown): PublicEncryptionJwk => {
  // `preferMap: true` decodes every CBOR map to a Map, including this sub-map.
  const map = wire as Map<string, string>;
  const out: Record<string, string> = {};
  for (const [key, member] of map) out[key] = member;
  return out as PublicEncryptionJwk;
};

// Declarative `CborSpec` fed to `@lindorm/cbor` — strict mode (default): an
// unknown label or a version mismatch is corruption and throws. Buffers are raw
// byte strings (no `encoding`); the version tag is the AES format major version.
export const AES_CBOR_SPEC: CborSpec = {
  version: { label: AES_CBOR_LABEL.version, value: AES_CBOR_VERSION },
  fields: [
    { key: "keyId", label: AES_CBOR_LABEL.keyId, kind: "text" },
    {
      key: "algorithm",
      label: AES_CBOR_LABEL.algorithm,
      kind: "enum",
      enum: AES_CBOR_ALG,
    },
    {
      key: "encryption",
      label: AES_CBOR_LABEL.encryption,
      kind: "enum",
      enum: AES_CBOR_ENC,
    },
    {
      key: "contentType",
      label: AES_CBOR_LABEL.contentType,
      kind: "enum",
      enum: AES_CBOR_CTY,
    },
    {
      key: "initialisationVector",
      label: AES_CBOR_LABEL.initialisationVector,
      kind: "bstr",
    },
    { key: "authTag", label: AES_CBOR_LABEL.authTag, kind: "bstr" },
    { key: "content", label: AES_CBOR_LABEL.content, kind: "bstr" },
    {
      key: "publicEncryptionKey",
      label: AES_CBOR_LABEL.publicEncryptionKey,
      kind: "bstr",
    },
    { key: "pbkdfIterations", label: AES_CBOR_LABEL.pbkdfIterations, kind: "int" },
    { key: "pbkdfSalt", label: AES_CBOR_LABEL.pbkdfSalt, kind: "bstr" },
    { key: "publicEncryptionIv", label: AES_CBOR_LABEL.publicEncryptionIv, kind: "bstr" },
    {
      key: "publicEncryptionTag",
      label: AES_CBOR_LABEL.publicEncryptionTag,
      kind: "bstr",
    },
    {
      key: "publicEncryptionJwk",
      label: AES_CBOR_LABEL.publicEncryptionJwk,
      kind: "bespoke",
      encode: encodeEpk,
      decode: decodeEpk,
    },
  ],
};

// One shared codec instance, built once from the spec, used by the encode and
// decode paths. `cde: true` (deterministic key order) makes the header-only
// re-encode on decrypt byte-identical to the AAD computed at encrypt time.
export const AES_CBOR_KIT = new CborKit<AesCborRecord>(AES_CBOR_SPEC);
