import type { CborField, CborValueKind } from "@lindorm/cbor";
import { CborKit } from "@lindorm/cbor";
import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";
import {
  CLAIM_SPECS,
  type ClaimSpec,
  coseLabel,
  coseName,
} from "../claims/claims-registry.js";
import { isPrivateUseLabel } from "../registry/is-private-use-label.js";
import { codecFor } from "../registry/param-spec.js";
import { decodeActCompact, encodeActCompact } from "./act-claim.js";
import { decodeCnf, encodeCnf } from "./cose-key.js";
import { decodeSubIdCompact, encodeSubIdCompact } from "./sub-id-claim.js";

// The CWT claims layer expressed as one declarative CBOR spec over the single
// claim registry, replacing the hand-rolled encode/decode engine while keeping the
// wire BYTE-IDENTICAL. Only the map-level mapping (label ↔ JOSE key, value kinds,
// the proprietary dual-key) lives here; the COSE byte layer (Tag / Buffer / CDE /
// preferMap) stays in cbor.ts, fed the map this kit produces.

// OIDC hash claims: b64url string <-> COSE byte string (cbor's native bstr kind;
// "b64u" is the same url-safe alphabet as the constant B64U). DERIVED from the
// registry `bespoke` sub-kinds — the single source of truth — never hardcoded:
// `"hash"` are the OIDC hashes (at_hash/c_hash/s_hash), `"act"` the RFC 8693
// delegation claims (act/may_act).
const bespokeDomains = (bespoke: string): Set<string> =>
  new Set(
    CLAIM_SPECS.filter(
      (spec) => spec.codec.kind === "bespoke" && spec.codec.bespoke === bespoke,
    ).map((spec) => spec.domain),
  );

const HASH_DOMAINS = bespokeDomains("hash");
const ACT_DOMAINS = bespokeDomains("act");

// cti (RFC 8392 label 7): the token id string is carried as its raw UTF-8 bytes.
const encodeCti = (value: unknown): Buffer => Buffer.from(String(value), "utf8");
const decodeCti = (wire: unknown): string =>
  Buffer.from(wire as Uint8Array).toString("utf8");

// The value-shaping half of a claim whose registry kind is "bespoke", keyed by its
// domain name. Since Phase 5 the translator (`domainToCose`) delivers ALREADY-WIRE
// values, so these handlers do CBOR byte/structure concerns ONLY: hashes fold into
// cbor's bstr kind; `cnf` accepts the JOSE `cnf` (`jkt`/`jwk`/`kid`) the translator
// built and turns it into a COSE cnf map (encodeCnf); `act`/`mayAct` accept the
// wire act (`sub`/`iss`/`aud`/`client_id`) and switch compact-vs-interoperable on
// the encode `proprietary` option; the rest are carried verbatim.
const shapeByDomain = (domain: string): Partial<CborField> => {
  if (HASH_DOMAINS.has(domain)) return { kind: "bstr", encoding: "b64u" };

  if (domain === "confirmation") {
    return {
      kind: "bespoke",
      encode: (value) => encodeCnf(value as Dict),
      decode: (value) => decodeCnf(value as Map<number, unknown>),
    };
  }

  if (ACT_DOMAINS.has(domain)) {
    return {
      kind: "bespoke",
      encode: (value, options) =>
        options.proprietary ? encodeActCompact(value as Dict) : value,
      decode: (value) => (value instanceof Map ? decodeActCompact(value) : value),
    };
  }

  if (domain === "subjectId") {
    return {
      kind: "bespoke",
      encode: (value, options) =>
        options.proprietary ? encodeSubIdCompact(value as Dict) : value,
      decode: (value) => (value instanceof Map ? decodeSubIdCompact(value) : value),
    };
  }

  // events / authorizationDetails: dynamic string-keyed shapes carried verbatim.
  return { kind: "bespoke", encode: (value) => value, decode: (value) => value };
};

// The codec KEYS by the COSE wire name (`coseName`) — the vocabulary
// `domainToCose`/`coseToDomain` speak, so a name-diverging claim is looked up under
// its COSE name (`cti`, not `jti`); the on-wire label is unchanged (`cti` keeps
// integer label 7), so the bytes stay identical. The label is the registered /
// private-use integer where one exists, else the wire string (labels:"mixed"). A
// private-use label (< -65536) is proprietary: compact integer on-platform, string
// key off-platform.
//
// This is the ONE reader of the PER-WIRE codec: it asks the registry what the
// claim's shape is on the COSE wire specifically, which is how `tokenId` — text
// on JOSE, a byte string on COSE — resolves to `bstr` here and to `text` in the
// translator.
const fieldForClaim = (spec: ClaimSpec): CborField => {
  const wireKey = coseName(spec);
  const label = coseLabel(spec);
  const base = {
    key: wireKey,
    label: label ?? wireKey,
    // The SAME range predicate the header side gates on (RFC 8392 §9.1.1 and
    // RFC 8152 §16.2 state the boundary in the same words) — one fact, not two
    // copies of `-65536` that can drift.
    proprietary: label !== undefined && isPrivateUseLabel(label),
  };

  const codec = codecFor(spec, "cose");

  switch (codec.kind) {
    case "text":
    case "int":
    case "array":
    case "date":
    case "bool":
      return { ...base, kind: codec.kind as CborValueKind };
    case "bstr":
      return { ...base, kind: "bespoke", encode: encodeCti, decode: decodeCti };
    case "bespoke":
      return { ...base, ...shapeByDomain(spec.domain) } as CborField;
    default: {
      // `noImplicitReturns` is off repo-wide, so without this a codec kind added
      // to the registry would silently yield `undefined` here and the claim would
      // vanish from the CWT spec rather than failing the build.
      const exhaustive: never = codec;
      throw new CoseError("Unhandled CWT claim codec kind", {
        code: "cose_unhandled_codec_kind",
        data: {
          claim: spec.domain,
          kind: String((exhaustive as { kind?: unknown }).kind),
        },
        title: "Unhandled CWT Claim Codec Kind",
        details:
          "The claim registry declares a codec kind the CWT spec builder does not map to a CBOR field, so the claim has no COSE wire shape.",
      });
    }
  }
};

export const CWT_CLAIMS_KIT = new CborKit({
  labels: "mixed",
  mode: "lax",
  fields: CLAIM_SPECS.map(fieldForClaim),
});
