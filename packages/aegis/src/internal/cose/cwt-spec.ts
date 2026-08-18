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

    // The one that genuinely has no COSE shaping to do, stated rather than left
    // to a fall-through: an RFC 8417 `events` map is keyed by event-type URI, so
    // it reaches the wire as the translator built it.
    case "events":
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
 * Whether a member set describes ONE structure or the ELEMENTS of a collection.
 *
 * ⚠ REQUIRED, with no default, and that is the point. `fieldForClaim` reaches the
 * same builder from two arms, and the compact encoder needs to know which — a
 * default would silently give one of them the other's behaviour, which is exactly
 * how a collection reached a signed token as an empty map.
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
 * The value-shaping half of a claim whose COSE codec declares a STRUCTURE — the
 * shape DERIVED from the member set, never a second hand-written table beside
 * the registry's.
 *
 * The one question that decides the shape is how the members are KEYED on COSE:
 *
 *   - EVERY member string-keyed (`wireName`). The translator has already emitted
 *     the structure under exactly those names, so there is nothing left to do
 *     and the value rides verbatim: the OIDC Core §5.1.1 `address` and the
 *     RFC 9396 `authorization_details` ELEMENT (reached through the same builder,
 *     since an array of structures asks this question of its element).
 *   - EVERY member carrying an INTEGER label (`wireLabel`). That is the compact
 *     COSE form — a label map, walked by `internal/cose/compact-map.ts` off a
 *     spec DERIVED from the very same member declarations — and it is what the
 *     RFC 8693 actor chain takes.
 *
 * ⚠⚠ A MIXED SET THROWS, AND THE REASON IS NARROWER THAN IT WAS. It used to be a
 * DATA-LOSS argument — a label map had nowhere to put an unlabelled member, so
 * compacting a mixed set dropped it from a signed token. That is no longer true:
 * `compactEncode` walks the VALUE and gives an unlabelled member its own string
 * key, which RFC 9052 §1.5 permits outright ("In COSE, we use text strings,
 * negative integers, and unsigned integers as map keys", grammar
 * `label = int / tstr`). So a mixed set is now REPRESENTABLE, and the refusal is
 * kept as a MIGRATION guard rather than a correctness one: a half-labelled member
 * set is what a migration looks like halfway through, and emitting one would
 * freeze that halfway state onto a signed wire where a later completion moves
 * bytes. It is stated as the weaker claim it is, and it names every member on the
 * minority side so the intended completion is obvious.
 * ⚠ Rendering a declared integer label as a TEXT key would still be wrong outright
 * — CBOR keys the integer `2` and the text `"2"` apart, so the token would carry a
 * member the registry says it does not — but nothing reaches that any more.
 *
 * ⚠⚠ IT ASKS THE QUESTION AT EVERY DEPTH, NOT ONLY OF THE DIRECT CHILDREN. A
 * member's own codec may declare a structure, and the two keyings cannot
 * interleave down a tree either: `CompactSpec.nested` holds compact specs alone,
 * and a verbatim value has nothing that would reach inside it to compact a level.
 * So the verdict is taken over EVERY member reachable from the claim.
 *
 * ⚠ THE WALK NEEDS CYCLE PROTECTION AND HAS IT. RFC 8693 §4.1 defines the actor
 * chain recursively — an `act` contains an `act` — so a member set can and does
 * reference itself, and a naive descent would not terminate. The `children`
 * THUNK is the stable identity to key on: a self-referential declaration is the
 * same function object every time it is reached, whereas the arrays it returns
 * are fresh on each call and would defeat a visited set.
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
      // The member's path from the claim, so a refusal names WHERE the odd member
      // is rather than only what it is called — at depth the leaf name alone
      // ("sub") does not locate it.
      const here = path.length === 0 ? member.domain : `${path}.${member.domain}`;

      if (wireKeyLabel(member.wire.cose) === undefined) textKeyed.push(here);
      else labelled.push(here);

      // A member's own structure, whether it holds ONE (`object`) or MANY
      // (`array` with `of`). Both descend, because the keying question is equally
      // live at either — and reaching only the first would leave the guard silent
      // about exactly the form this claim registry has now gained.
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
    // ⭐ THE SPEC IS BUILT ONCE, HERE, AND CLOSED OVER. `fieldForClaim` runs at
    // module load, so the derivation cost is paid once per claim rather than once
    // per token — and, more to the point, the encode and decode halves are then
    // provably reading the SAME table rather than two derivations of it.
    const spec = compactSpecFromMembers(domain, children);

    return {
      kind: "bespoke",
      // The compact label map is PROPRIETARY. Two of the actor labels — the
      // `client_id` 4 and the nested `act` 5 — are registered in no COSE or CWT
      // registry at all, so only a verifier holding THIS registry can read the
      // map. An interoperable token therefore keeps the string-keyed structure
      // the translator already built.
      //
      // ⚠⚠ THE `form` BRANCH IS A FIX, NOT SYMMETRY. Without it the collection arm
      // handed `compactEncode` the ARRAY: it matched no member, and the claim
      // reached a SIGNED token as an EMPTY MAP. Measured before the fix —
      // `shapeForObject("syntheticCollection", [labelled("sub", 2), labelled("iss", 1)])`
      // then `.encode([{ sub: "a", iss: "b" }, { sub: "c" }], { proprietary: true })`
      // yielded `Map(0) {}`. ⭐ IT IS NO LONGER LATENT: RFC 9493 §3.2.8's
      // `sub_id.identifiers` is a labelled array of self, so the collection arm
      // is now reached by a REAL claim in the proprietary encoding, and
      // `classes/sub-id-claim-wire.test.ts` pins the resulting bytes at depth.
      // (`authorizationDetails`'s single declared member is text-keyed, so it
      // reaches the verbatim arm above and never gets here.)
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
/**
 * ⚠ EXPORTED FOR ITS DRIFT GUARD ALONE, exactly as the three shapers above are.
 * No production caller reaches it except `CWT_CLAIMS_KIT` below.
 *
 * ⭐ THE GUARD HAS TO ENTER HERE, NOT AT A SHAPER. Calling `shapeForObject`
 * directly with a claim's children proves the SHAPER refuses a labelled member;
 * it proves nothing about whether this function still routes a structured claim
 * to it. Measured: routing the `of` arm to cbor's native `array` kind instead
 * leaves the corpus byte-identical and the suite green — so the routing is
 * unobservable on the wire, and the ONLY thing that choice buys is the refusal.
 * A guard that cannot see the routing would let a future edit take the
 * byte-identical path and silently delete that refusal.
 */
export const fieldForClaim = (spec: ClaimSpec): CborField => {
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
    case "date":
    case "bool":
      return { ...base, kind: codec.kind as CborValueKind };
    // An array of STRINGS is cbor's native `array` kind. An array of DECLARED
    // STRUCTURES asks the SAME question a single structure does — are the
    // members string-keyed or labelled on COSE — so it is answered by the same
    // builder rather than by a second one that could answer it differently.
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
