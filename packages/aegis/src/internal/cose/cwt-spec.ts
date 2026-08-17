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
import type { BespokeKind } from "../registry/claim-spec.js";
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

// cti (RFC 8392 label 7): the token id string is carried as its raw UTF-8 bytes.
const encodeCti = (value: unknown): Buffer => Buffer.from(String(value), "utf8");
const decodeCti = (wire: unknown): string =>
  Buffer.from(wire as Uint8Array).toString("utf8");

// A structured value carried onto the wire exactly as the translator built it.
// Named once and shared by the three sub-kinds that take it, so each of them is
// an explicit arm below rather than a fall-through nobody declared.
const VERBATIM: Partial<CborField> = {
  kind: "bespoke",
  encode: (value) => value,
  decode: (value) => value,
};

/**
 * The value-shaping half of a claim whose registry kind is `bespoke`, keyed by
 * the sub-kind the registry DECLARES. Since Phase 5 the translator
 * (`domainToCose`) delivers ALREADY-WIRE values, so these handlers do CBOR
 * byte/structure concerns ONLY.
 *
 * ⚠ IT IS KEYED ON `BespokeKind`, NOT ON THE DOMAIN NAME, and that is the whole
 * point of the function. Keyed on the name it was a chain of `if`s over an OPEN
 * set — `spec.domain: string` — ending in a catch-all that returned an identity
 * codec, with the enclosing `never` guard pointing at `codec.kind` instead. Two
 * consequences, both reachable and neither a compile error:
 *
 *   1. A `BespokeKind` MEMBER THE SWITCH HAS NO ARM FOR compiled clean and
 *      shipped an UNSHAPED CBOR value. The DOMAIN mint path throws first
 *      (`translate.ts`'s `encodeBespoke` has its own `never`), but
 *      `aegis.cwt.sign` does not: `raw-sign-cwt.ts` takes an already-wire
 *      `CwtClaimsWire` and hands it straight to `CwtKit.sign` with no
 *      translation, while the field spec still comes from the registry.
 *   2. A SECOND claim declaring an EXISTING sub-kind under a new domain name fell
 *      through too — `confirmation` and `subjectId` were matched as literal domain
 *      strings while `act` was derived from the sub-kind — and that one raised
 *      nothing anywhere, because the translator's `confirmation` arm handles any
 *      claim declaring the kind perfectly well.
 *
 * The exhaustive `switch` deletes the catch-all rather than adding a rule to
 * resolve it: with every sub-kind named, an unshaped value has nowhere to fall.
 *
 * ⚠ EXPORTED FOR ITS DRIFT GUARD ALONE. No production caller reaches it except
 * `fieldForClaim` below; the only way to observe the guard bite is to hand it a
 * sub-kind the union does not have, which `cwt-spec.test.ts` does with a cast
 * confined to that file.
 */
export const shapeForBespoke = (bespoke: BespokeKind): Partial<CborField> => {
  switch (bespoke) {
    // `cnf` accepts the JOSE `cnf` (`jkt`/`jwk`/`kid`) the translator built and
    // turns it into a COSE cnf map.
    case "confirmation":
      return {
        kind: "bespoke",
        encode: (value) => encodeCnf(value as Dict),
        decode: (value) => decodeCnf(value as Map<number, unknown>),
      };

    // `act`/`may_act` accept the wire act (`sub`/`iss`/`aud`/`client_id`) and
    // switch compact-vs-interoperable on the encode `proprietary` option.
    case "act":
      return {
        kind: "bespoke",
        encode: (value, options) =>
          options.proprietary ? encodeActCompact(value as Dict) : value,
        decode: (value) => (value instanceof Map ? decodeActCompact(value) : value),
      };

    case "subId":
      return {
        kind: "bespoke",
        encode: (value, options) =>
          options.proprietary ? encodeSubIdCompact(value as Dict) : value,
        decode: (value) => (value instanceof Map ? decodeSubIdCompact(value) : value),
      };

    // The three that genuinely have no COSE shaping to do, each stated rather
    // than left to a fall-through: an RFC 8417 `events` map is keyed by
    // event-type URI, an RFC 9396 `authorization_details` element is defined by
    // whoever registers its `type`, and an OIDC `address` was already
    // snake-cased by the translator. All three reach the wire as the translator
    // built them.
    case "events":
    case "authDetails":
    case "address":
      return VERBATIM;

    default: {
      // `noImplicitReturns` is off repo-wide, so without this a `BespokeKind`
      // added without an arm would silently take the identity codec and put an
      // unshaped CBOR value on a signed wire.
      const exhaustive: never = bespoke;
      throw new CoseError("Unhandled bespoke CWT claim sub-kind", {
        code: "cose_unhandled_bespoke_kind",
        data: { bespoke: String(exhaustive) },
        title: "Unhandled Bespoke CWT Claim Sub-Kind",
        details:
          "The claim registry declares a bespoke sub-kind the CWT spec builder has no CBOR shape for, so the claim would reach the COSE wire unshaped.",
      });
    }
  }
};

/**
 * The value-shaping half of a claim whose COSE codec is `bstr`, keyed by the
 * `encoding` the registry DECLARES — how the claim's DOMAIN string becomes the
 * bytes on the wire.
 *
 * ⚠ THE REGISTRY'S `encoding` IS A SELECTOR, NOT A VALUE FORWARDED UNDER THE
 * SAME NAME. `CborField.encoding` is `"b64u" | "base64"` — it has no `"utf8"`
 * member, and `@lindorm/cbor` reads it as "the domain value is a base64 STRING
 * in this alphabet". `"utf8"` is a different question ("the string's own
 * bytes"), which cbor models as a bespoke encode/decode pair, so the two
 * encodings resolve to two different CBOR field SHAPES. Writing
 * `{ kind: "bstr", encoding: codec.encoding }` would compile for `"b64u"` and
 * fail the type for `"utf8"` — and would become a silent wrong-bytes bug the day
 * cbor widened its union.
 *
 * ⚠ EXPORTED FOR ITS DRIFT GUARD ALONE, exactly as {@link shapeForBespoke} is:
 * no production caller reaches it except `fieldForClaim` below, and the only way
 * to observe the guard bite is to hand it an encoding the union does not have.
 */
export const shapeForBstr = (encoding: "utf8" | "b64u"): Partial<CborField> => {
  switch (encoding) {
    // RFC 8392 §3.1.7 `cti`: the token id string carried as its own UTF-8 bytes.
    // cbor has no field kind for that, so it is a bespoke pair.
    case "utf8":
      return { kind: "bespoke", encode: encodeCti, decode: decodeCti };

    // The OIDC hashes fold into cbor's NATIVE bstr kind; "b64u" is the same
    // url-safe alphabet as the constant B64U.
    case "b64u":
      return { kind: "bstr", encoding: "b64u" };

    default: {
      // `noImplicitReturns` is off repo-wide, so without this a third encoding
      // would silently yield `undefined` and strip the claim's byte shape.
      const exhaustive: never = encoding;
      throw new CoseError("Unhandled CWT byte-string encoding", {
        code: "cose_unhandled_bstr_encoding",
        data: { encoding: String(exhaustive) },
        title: "Unhandled CWT Byte-String Encoding",
        details:
          "The claim registry declares a byte-string encoding the CWT spec builder has no CBOR shape for, so the claim would reach the COSE wire unshaped.",
      });
    }
  }
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
// claim's shape is on the COSE wire specifically, which is how every claim that
// is text on JOSE and bytes on COSE — the token id and the three OIDC hashes —
// resolves to `bstr` here and to `text` in the translator. Which BYTES is the
// codec's `encoding`, not this function's business (see `shapeForBstr`).
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
      return { ...base, ...shapeForBstr(codec.encoding) } as CborField;
    case "bespoke":
      return { ...base, ...shapeForBespoke(codec.bespoke) } as CborField;
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
