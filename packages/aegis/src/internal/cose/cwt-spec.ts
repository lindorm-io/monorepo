import type { CborField, CborValueKind } from "@lindorm/cbor";
import { CborKit } from "@lindorm/cbor";
import { isArray } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";
import {
  CLAIM_SPECS,
  type ClaimSpec,
  coseLabel,
  coseName,
} from "../claims/claims-registry.js";
import type { BespokeKind, ClaimMemberSpec } from "../registry/claim-spec.js";
import { isPrivateUseLabel } from "../registry/is-private-use-label.js";
import { codecFor } from "../registry/param-spec.js";
import { wireKeyLabel } from "../registry/wire-key.js";
import { type CompactSpec, compactDecode, compactEncode } from "./compact-map.js";
import { compactSpecFromMembers } from "./compact-spec-from-members.js";
import { decodeCnf, encodeCnf } from "./cose-key.js";

// The map-level mapping only — label ↔ JOSE key, value kinds, the proprietary
// dual-key. The COSE byte layer (Tag / Buffer / CDE / preferMap) stays in cbor.ts,
// fed the map this kit produces.

// RFC 8392 §3.1.7
const encodeCti = (value: unknown): Buffer => Buffer.from(String(value), "utf8");

/**
 * ⚠ Checked, not cast: a non-bstr `cti` would reach `Buffer.from` and throw a raw
 * `TypeError` out of the keyless `CwtKit.decode`/`CwmKit.decode` door, past a
 * caller's `AegisError` catch. RFC 8392 §3.1.7.
 */
const decodeCti = (wire: unknown): string => {
  if (wire instanceof Uint8Array) return Buffer.from(wire).toString("utf8");

  throw new CoseError("Malformed CWT claim", {
    code: "cose_malformed",
    data: { claim: "cti", label: 7 },
    title: "Malformed CWT",
    details:
      "aegis reads the cti (CWT ID) claim as a byte string; this token carries something else, so the token identifier cannot be read. RFC 8392 §3.1.7.",
  });
};

// A structured value that reaches the wire as the translator built it.
const VERBATIM: Partial<CborField> = {
  kind: "bespoke",
  encode: (value) => value,
  decode: (value) => value,
};

/**
 * The value-shaping half of a `bespoke` claim, keyed on `BespokeKind` — the closed
 * union — so a new sub-kind fails the build rather than falling through to an
 * identity codec. `translate.ts`'s `encodeBespoke` has its own `never`, but
 * `raw-sign-cwt.ts` hands `CwtKit.sign` an already-wire `CwtClaimsWire` with no
 * translation at all, so this is the only guard on that path.
 *
 * ⚠ Exported for the drift guard alone: `fieldForClaim` below is the sole
 * production caller, and `cwt-spec.test.ts` casts an absent sub-kind in.
 */
export const shapeForBespoke = (bespoke: BespokeKind): Partial<CborField> => {
  switch (bespoke) {
    case "confirmation":
      return {
        kind: "bespoke",
        encode: (value) => encodeCnf(value as Dict),
        // No cast: `decodeCnf` takes `unknown` and owns the container check, so
        // the shape a foreign token carried cannot be asserted away here.
        decode: (value) => decodeCnf(value),
      };

    // RFC 8417 — keyed by event-type URI, so nothing to reshape.
    case "events":
      return VERBATIM;

    default: {
      // `noImplicitReturns` is off repo-wide: without this, an unhandled sub-kind
      // returns `undefined` and puts an unshaped CBOR value on a signed wire.
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
 * Whether a member set describes ONE structure or the ELEMENTS of a collection.
 *
 * ⚠ Required, no default: `fieldForClaim` reaches `shapeForObject` from two arms,
 * and a default would give one of them the other's behaviour — which puts a
 * collection on a signed token as an empty map.
 */
export type StructureForm = "single" | "collection";

/** Compact ONE structure, or every element of a collection. */
const compactValue = (value: unknown, spec: CompactSpec, form: StructureForm): unknown =>
  form === "collection"
    ? isArray(value)
      ? value.map((element) => compactEncode(element as Dict, spec))
      : value
    : compactEncode(value as Dict, spec);

/** The mirror. A value that is not the compact shape rides back untouched. */
const decompactValue = (
  value: unknown,
  spec: CompactSpec,
  form: StructureForm,
): unknown =>
  form === "collection"
    ? isArray(value)
      ? value.map((element) =>
          element instanceof Map ? compactDecode(element, spec) : element,
        )
      : value
    : value instanceof Map
      ? compactDecode(value, spec)
      : value;

/**
 * The value-shaping half of a structured claim, DERIVED from the member set
 * rather than a second table beside the registry's. One question decides it: are
 * the members string-keyed (ride verbatim) or integer-labelled (compact label
 * map, walked by `compact-map.ts` off a spec derived from the same members)?
 *
 * ⚠ A MIXED SET THROWS as a MIGRATION guard, not a correctness one: RFC 9052 §1.5
 * makes it representable, and `compactEncode` gives an unlabelled member its own
 * string key. What the refusal buys is that a half-labelled member set cannot
 * freeze a halfway migration onto a signed wire, where completing it moves bytes.
 * The refusal names every member on the minority side.
 *
 * ⚠ The question is asked at EVERY depth, not only of the direct children:
 * `CompactSpec.nested` holds compact specs alone, and a verbatim value has nothing
 * that would reach inside it to compact a level, so the keyings cannot interleave.
 *
 * ⚠ The walk keys its visited set on the `children` THUNK, not the array it
 * returns — the arrays are fresh per call, and a member set can name ITSELF
 * (RFC 8693 §4.1), so a naive descent does not terminate.
 */
export const shapeForObject = (
  domain: string,
  children: ReadonlyArray<ClaimMemberSpec>,
  form: StructureForm,
): Partial<CborField> => {
  const labelled: Array<string> = [];
  const textKeyed: Array<string> = [];
  const seen = new Set<() => ReadonlyArray<ClaimMemberSpec>>();

  const visit = (members: ReadonlyArray<ClaimMemberSpec>, path: string): void => {
    for (const member of members) {
      // The path from the claim, so a refusal locates the odd member: at depth the
      // leaf name alone ("sub") does not.
      const here = path.length === 0 ? member.domain : `${path}.${member.domain}`;

      if (wireKeyLabel(member.wire.cose) === undefined) textKeyed.push(here);
      else labelled.push(here);

      // Both `object` and `array`-of-structures descend: the keying question is
      // equally live at either, so reaching only one leaves the guard half-blind.
      const nested =
        member.codec.kind === "object"
          ? member.codec.children
          : member.codec.kind === "array"
            ? member.codec.of?.children
            : undefined;

      if (nested === undefined) continue;
      if (seen.has(nested)) continue;

      seen.add(nested);
      visit(nested(), here);
    }
  };

  visit(children, "");

  if (labelled.length === 0) return VERBATIM;

  if (textKeyed.length === 0) {
    // Built once and closed over, so the encode and decode halves below provably
    // read the SAME table rather than two derivations of it.
    const spec = compactSpecFromMembers(domain, children);

    return {
      kind: "bespoke",
      // The compact label map is PROPRIETARY — some actor labels are in no COSE or
      // CWT registry, so only a verifier holding THIS registry reads it. Off
      // `proprietary`, the token keeps the string-keyed structure.
      //
      // ⚠ The `form` branch is load-bearing: handing `compactEncode` the ARRAY
      // matches no member and puts an EMPTY MAP on a signed token. The
      // `sub_id.identifiers` of RFC 9493 §3.2.8 reaches this arm for real, and
      // `classes/sub-id-claim-wire.test.ts` pins the bytes at depth.
      encode: (value, options) =>
        options.proprietary ? compactValue(value, spec, form) : value,
      decode: (value) => decompactValue(value, spec, form),
    };
  }

  throw new CoseError("Mixed COSE keying on a structured claim's members", {
    code: "cose_mixed_member_keying",
    data: { claim: domain, labelled, textKeyed },
    title: "Mixed COSE Keying On A Structured Claim's Members",
    details:
      "The claim registry declares a structured claim whose members are not keyed the same way on COSE — some carry integer labels and some do not — and the two cannot be rendered into one map without either putting a labelled member under a text key the registry does not declare or dropping an unlabelled member from a signed token.",
  });
};

/**
 * The value-shaping half of a `bstr` claim, keyed on the registry's `encoding`.
 *
 * ⚠ That `encoding` is a SELECTOR, not a value forwarded under the same name:
 * `CborField.encoding` means "the domain value is a base64 string in this
 * alphabet" and has no `"utf8"` member, so the two encodings resolve to two
 * different field shapes. `{ kind: "bstr", encoding: codec.encoding }` fails the
 * type today and turns into silent wrong bytes the day cbor widens its union.
 *
 * ⚠ Exported for the drift guard alone, as {@link shapeForBespoke} is.
 */
export const shapeForBstr = (encoding: "utf8" | "b64u"): Partial<CborField> => {
  switch (encoding) {
    // RFC 8392 §3.1.7. cbor has no field kind for it, so a bespoke pair.
    case "utf8":
      return { kind: "bespoke", encode: encodeCti, decode: decodeCti };

    case "b64u":
      return { kind: "bstr", encoding: "b64u" };

    default: {
      // `noImplicitReturns` is off repo-wide: without this a third encoding
      // returns `undefined` and strips the claim's byte shape.
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

/**
 * Keyed by the COSE wire name (`coseName`), the vocabulary
 * `domainToWire`/`wireToDomain` speak — so a name-diverging claim is looked up as
 * `cti`, not `jti`. The ONE reader of the per-wire codec: a claim that is text on
 * JOSE and bytes on COSE resolves to `bstr` here and `text` in the translator.
 *
 * ⚠ Exported for the drift guard alone; `CWT_CLAIMS_KIT` below is the sole
 * production caller. The guard has to enter HERE, not at a shaper: routing the
 * `of` arm to cbor's native `array` kind instead is byte-identical on the wire, so
 * the only thing the routing buys is `shapeForObject`'s mixed-keying refusal, and
 * a guard entering at the shaper cannot see that routing change.
 */
export const fieldForClaim = (spec: ClaimSpec): CborField => {
  const wireKey = coseName(spec);
  const label = coseLabel(spec);
  const base = {
    key: wireKey,
    label: label ?? wireKey,
    // The SAME predicate the header side gates on — one fact, not two copies of
    // `-65536` that can drift. RFC 8392 §9.1.1, RFC 8152 §16.2.
    proprietary: label !== undefined && isPrivateUseLabel(label),
  };

  const codec = codecFor(spec, "cose");

  switch (codec.kind) {
    case "text":
    case "int":
    case "date":
    case "bool":
      return { ...base, kind: codec.kind as CborValueKind };
    // An array of DECLARED STRUCTURES asks the same keying question a single
    // structure does, so it goes to the same builder rather than a second one
    // that could answer it differently.
    case "array":
      return codec.of === undefined
        ? ({ ...base, kind: codec.kind as CborValueKind } as CborField)
        : ({
            ...base,
            ...shapeForObject(spec.domain, codec.of.children(), "collection"),
          } as CborField);
    case "bstr":
      return { ...base, ...shapeForBstr(codec.encoding) } as CborField;
    case "object":
      return {
        ...base,
        ...shapeForObject(spec.domain, codec.children(), "single"),
      } as CborField;
    case "bespoke":
      return { ...base, ...shapeForBespoke(codec.bespoke) } as CborField;
    default: {
      // `noImplicitReturns` is off repo-wide: without this a new codec kind
      // returns `undefined` and the claim vanishes from the CWT spec.
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
