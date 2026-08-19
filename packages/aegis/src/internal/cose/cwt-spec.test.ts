import { SYNTHETIC_SPEC } from "../../__fixtures__/synthetic-spec.js";
import { describe, expect, test } from "vitest";
import { CoseError } from "../../errors/index.js";
import { CLAIM_SPECS, type ClaimSpec, claimByDomain } from "../claims/claims-registry.js";
import type { BespokeKind, ClaimMemberSpec } from "../registry/claim-spec.js";
import { codecFor } from "../registry/param-spec.js";
import { wireLabel, wireName } from "../registry/wire-key.js";
import {
  fieldForClaim,
  shapeForBespoke,
  shapeForBstr,
  shapeForObject,
  type StructureForm,
} from "./cwt-spec.js";

/**
 * The CWT claim shaper's DRIFT GUARD.
 *
 * `shapeForBespoke` is the only thing standing between a registry declaration and
 * the CBOR bytes a structured claim reaches the COSE wire as. It used to be keyed
 * on `spec.domain` — a `string`, an OPEN set — and to end in a catch-all identity
 * codec, so a sub-kind it had no arm for was shaped by NOTHING and shipped
 * verbatim. It is now keyed on `BespokeKind` with an exhaustive `switch`.
 *
 * ⚠ THE PROTECTION HAS TWO HALVES AND ONLY ONE IS TESTABLE, which this file
 * states rather than glosses over:
 *
 *  - The RUNTIME half — a sub-kind with no arm THROWS instead of returning an
 *    identity codec — is what the first test below asserts. Against the previous
 *    `shapeByDomain("anything-unlisted")` it does not throw at all, which is what
 *    makes the test worth having.
 *  - The COMPILE-TIME half — `const exhaustive: never = bespoke` failing the
 *    build the moment a `BespokeKind` is added without an arm — CANNOT be
 *    asserted by a test, because writing one would mean adding that member to the
 *    very union whose exhaustiveness is the property. It is verified by reading
 *    the `default` block, and this paragraph is the record that it is.
 *
 * `shapeForBstr` is the same guard over the same question one union along — WHICH
 * BYTES a `bstr` claim's domain string becomes — and is guarded here identically.
 */
describe("shapeForBespoke — the CWT claim shaper's drift guard", () => {
  test("a sub-kind with no arm THROWS rather than shipping an unshaped value", () => {
    // ⚠ The cast is confined to this line and must stay here. Adding a `"__test"`
    // member to `BespokeKind` would make the call type-check — and would ship a
    // fake sub-kind inside the union the guard exists to keep exhaustive.
    expect(() => shapeForBespoke("unlisted" as BespokeKind)).toThrow(CoseError);

    try {
      shapeForBespoke("unlisted" as BespokeKind);
      expect.unreachable("the guard did not throw");
    } catch (error) {
      expect((error as CoseError).code).toBe("cose_unhandled_bespoke_kind");
      expect((error as CoseError).data).toEqual({ bespoke: "unlisted" });
    }
  });

  test("every sub-kind the registry DECLARES has an arm", () => {
    // DERIVED from the registry, not a hand-written list: the day a claim
    // declares a sub-kind with no arm, this fails at RUNTIME here as well as at
    // compile time in the `default` block — and it fails naming the kind.
    const declared = new Set(
      CLAIM_SPECS.flatMap((spec) =>
        spec.codec.kind === "bespoke" ? [spec.codec.bespoke] : [],
      ),
    );

    expect(declared.size).toBeGreaterThan(0);

    for (const bespoke of declared) {
      expect(() => shapeForBespoke(bespoke), `no arm for "${bespoke}"`).not.toThrow();
      expect(
        shapeForBespoke(bespoke).kind,
        `"${bespoke}" has no CBOR kind`,
      ).toBeDefined();
    }
  });

  test("the shape a sub-kind resolves to is keyed by the DECLARATION, not the name", () => {
    // The second half of the defect: `confirmation` and `subjectId` were matched
    // as literal DOMAIN strings, so a second claim declaring an existing sub-kind
    // under a different name fell through to the identity codec with nothing
    // raised anywhere. Asking the function by KIND — the only thing it now takes
    // — is what makes that impossible.
    // (`subjectId` was the second of that pair and is no longer bespoke at all:
    // it declares an RFC 9493 member set and resolves through `shapeForObject`.)
    expect(shapeForBespoke("confirmation").kind).toBe("bespoke");
    expect(shapeForBespoke("events").kind).toBe("bespoke");
  });

  test("the verbatim sub-kind still carries its value through untouched", () => {
    // Behaviour PRESERVATION: `events` reached the identity codec by FALLING
    // THROUGH the old chain and now reaches it by being named. The codec it gets
    // must be the same one. (`address` and `authDetails` were two more until
    // they declared their members; a declared structure resolves through
    // `shapeForObject` instead, which DERIVES the same verdict from the member
    // set rather than stating it here.)
    const field = shapeForBespoke("events");
    const value = { any: ["shape", 1, true] };

    expect(field.kind).toBe("bespoke");
    expect(field.encode?.(value, { proprietary: false })).toBe(value);
    expect(field.decode?.(value)).toBe(value);
  });
});

/**
 * The BYTE-ENCODING shaper's drift guard.
 *
 * ⚠ `encoding` on a registry `bstr` codec is a SELECTOR for a `CborField` SHAPE,
 * not a value forwarded under the same name. `CborField.encoding` is
 * `"b64u" | "base64"` and has no `"utf8"` member — `"utf8"` means "the string's
 * own bytes", which cbor models as a bespoke encode/decode pair. The two answers
 * therefore resolve to two different CBOR field shapes, and this file is where
 * that stays true.
 */
describe("shapeForBstr — the CWT byte-encoding shaper's drift guard", () => {
  test("an encoding with no arm THROWS rather than shipping an unshaped value", () => {
    // ⚠ The cast is confined to these two lines, for the reason the sibling guard
    // above states: a `"__test"` member added to the union would type-check the
    // call and ship a fake encoding inside the union the guard keeps exhaustive.
    expect(() => shapeForBstr("base64" as "utf8" | "b64u")).toThrow(CoseError);

    try {
      shapeForBstr("base64" as "utf8" | "b64u");
      expect.unreachable("the guard did not throw");
    } catch (error) {
      expect((error as CoseError).code).toBe("cose_unhandled_bstr_encoding");
      expect((error as CoseError).data).toEqual({ encoding: "base64" });
    }
  });

  test("every encoding the registry DECLARES has an arm", () => {
    // DERIVED from the registry, like its sibling: a claim declaring a per-wire
    // COSE `bstr` with an unhandled encoding fails here naming the encoding.
    const declared = new Set(
      CLAIM_SPECS.flatMap((spec) => {
        const cose = codecFor(spec, "cose");
        return cose.kind === "bstr" ? [cose.encoding] : [];
      }),
    );

    expect(declared.size).toBeGreaterThan(0);

    for (const encoding of declared) {
      expect(() => shapeForBstr(encoding), `no arm for "${encoding}"`).not.toThrow();
    }
  });

  test("the two encodings resolve to DIFFERENT cbor field shapes", () => {
    // The whole reason `encoding` is required with no default: pick the wrong
    // one and the claim still encodes, to different bytes, on a signed wire.
    const utf8 = shapeForBstr("utf8");
    const b64u = shapeForBstr("b64u");

    // "utf8" is cbor-bespoke — cbor has no native kind for "the string's own
    // bytes" — and carries the pair that performs it.
    expect(utf8.kind).toBe("bespoke");
    expect(utf8.encode?.("AAA", { proprietary: false })).toEqual(Buffer.from("AAA"));
    expect(utf8.decode?.(Buffer.from("AAA"))).toBe("AAA");

    // "b64u" is cbor's NATIVE bstr kind with the url-safe alphabet, and carries
    // no encode/decode pair — cbor forbids one on a non-bespoke kind.
    expect(b64u).toEqual({ kind: "bstr", encoding: "b64u" });

    // The observable consequence, stated as bytes: the same 4-char domain string
    // is 4 bytes under "utf8" and the 3 bytes it decodes to under "b64u".
    expect((utf8.encode?.("QUJD", { proprietary: false }) as Buffer).length).toBe(4);
    expect(Buffer.from("QUJD", "base64url").length).toBe(3);
  });
});

/**
 * The STRUCTURE shaper's drift guard.
 *
 * `shapeForObject` decides how a claim with a DECLARED member set reaches the
 * COSE wire, and it decides it by DERIVING the answer from the members rather
 * than by consulting a second table beside the registry — which is the whole
 * reason the member set was declared. The derivation has exactly one input: how
 * the members are keyed on COSE.
 *
 * ⚠ THE REFUSAL IS THE INTERESTING HALF, and what it refuses is a MIXED set — as
 * a MIGRATION guard, which is a weaker claim than the data-loss one it used to
 * make and is stated as such in `cwt-spec.ts`. A half-labelled member set is what
 * a migration looks like halfway through, and emitting one freezes that halfway
 * state onto a signed wire. (Shipping a labelled member under its TEXT name would
 * still be wrong outright — CBOR keys the integer `2` and the text `"2"` apart,
 * so the token would carry a member the registry says it does not — but the
 * refusal is what stops anything reaching it.)
 */
describe("shapeForObject — the CWT structure shaper's drift guard", () => {
  // ⚠ THE SYNTHETIC STRUCTURES BELOW STATE `open: "verbatim"`, AND THE SHAPER
  // NEVER READS IT. `ObjectCodec.open` is a required three-way cell, so every
  // declaration answers it — including one written only to drive this shaper —
  // and the shaper derives its compact spec from the members' LABELS alone
  // (`internal/cose/cwt-spec.ts`), so no value here changes an assertion. It
  // mirrors what the registered structures these stand in for actually declare
  // (`act`, `authorizationDetails[]`), which is the only reading that stays true
  // if the cell ever does reach the COSE side.
  const textMember = (domain: string): ClaimMemberSpec => ({
    domain,
    spec: SYNTHETIC_SPEC,
    wire: { jose: wireName(domain), cose: wireName(domain) },
    codec: { kind: "text" },
    whenEmpty: "keep",
    sample: "sample",
  });

  const labelledMember = (domain: string, label: number): ClaimMemberSpec => ({
    domain,
    spec: SYNTHETIC_SPEC,
    wire: { jose: wireName(domain), cose: wireLabel(label, domain) },
    codec: { kind: "text" },
    whenEmpty: "keep",
    sample: "sample",
  });

  test("an all-text-keyed member set rides the wire exactly as the translator built it", () => {
    const field = shapeForObject("address", [textMember("street_address")], "single");
    const value = { street_address: "1 Byron Way" };

    expect(field.kind).toBe("bespoke");
    expect(field.encode?.(value, { proprietary: false })).toBe(value);
    expect(field.decode?.(value)).toBe(value);
  });

  /** What an unshaped-but-legal structure resolves to — the identity codec. */
  const VERBATIM_FIELD = shapeForObject("reference", [textMember("any")], "single");

  test("an all-labelled member set becomes a compact label map derived from the declarations", () => {
    // The arm the RFC 8693 actor chain takes. ⭐ The label table is DERIVED from
    // the member declarations — the hand-written `ACT_SPEC` this replaced was a
    // second place the same five labels were written down, and the wire was
    // decided by whichever copy the byte layer happened to read.
    const field = shapeForObject(
      "synthetic",
      [labelledMember("iss", 1), labelledMember("sub", 2)],
      "single",
    );
    const value = { iss: "https://issuer.test", sub: "user-1" };

    expect(field.kind).toBe("bespoke");

    // ⚠ BOTH MODES, because the option is the whole switch. A member label is
    // assigned by nobody but this registry — no IANA registry names the members
    // INSIDE a claim — so an interoperable token keeps the string-keyed structure
    // the translator built and only an on-platform one collapses to integers.
    // Asserting one half alone is satisfied by a shaper that ignored the option
    // entirely.
    expect(field.encode?.(value, { proprietary: false })).toBe(value);
    expect(field.encode?.(value, { proprietary: true })).toEqual(
      new Map<number, unknown>([
        [1, "https://issuer.test"],
        [2, "user-1"],
      ]),
    );

    // …and back, keyed by the interoperable STRING fallback the labels carry —
    // which is the vocabulary the translator reads a structure in.
    expect(
      field.decode?.(
        new Map<number, unknown>([
          [1, "https://issuer.test"],
          [2, "user-1"],
        ]),
      ),
    ).toEqual(value);
  });

  test("a SELF-REFERENTIAL all-labelled set compacts at EVERY depth", () => {
    // ⭐ THE RECURSION PROOF at the shaper level. `CompactSpec.nested` takes a
    // THUNK, so the derived spec builds one level per level of actual DATA and
    // terminates with the value rather than with the declaration — which is the
    // only way a self-referential member set can be compacted at all.
    const children = (): ReadonlyArray<ClaimMemberSpec> => [
      labelledMember("sub", 2),
      {
        domain: "act",
        spec: SYNTHETIC_SPEC,
        wire: { jose: wireName("act"), cose: wireLabel(5, "act") },
        codec: { kind: "object", children, open: "verbatim" },
        whenEmpty: "keep",
        sample: {},
      },
    ];

    const field = shapeForObject("synthetic", children(), "single");
    const value = { sub: "a", act: { sub: "b", act: { sub: "c" } } };

    // THREE levels: a spec that compacted only the top would leave the inner
    // actors string-keyed, and a round trip through this package would agree
    // with itself about it.
    expect(field.encode?.(value, { proprietary: true })).toEqual(
      new Map<number, unknown>([
        [2, "a"],
        [
          5,
          new Map<number, unknown>([
            [2, "b"],
            [5, new Map<number, unknown>([[2, "c"]])],
          ]),
        ],
      ]),
    );
  });

  test("a MIXED member set THROWS rather than picking one of the two keyings", () => {
    const mixed = (): ReadonlyArray<ClaimMemberSpec> => [
      textMember("iss"),
      labelledMember("sub", 2),
    ];

    expect(() => shapeForObject("synthetic", mixed(), "single")).toThrow(CoseError);

    try {
      shapeForObject("synthetic", mixed(), "single");
      expect.unreachable("the guard did not throw");
    } catch (error) {
      expect((error as CoseError).code).toBe("cose_mixed_member_keying");
      // It names the members on BOTH sides, not merely the claim: a set with one
      // odd member among six is what a migration produces half-way through, and
      // which members sit on which side is the only fact that makes the refusal
      // actionable — the repair may be to label the one or to unlabel the other.
      expect((error as CoseError).data).toEqual({
        claim: "synthetic",
        labelled: ["sub"],
        textKeyed: ["iss"],
      });
    }
  });

  test("a labelled member NESTED inside a text-keyed structure is refused too", () => {
    // ⚠ THE CASE A ONE-LEVEL GUARD IS SILENT ABOUT. A member's own codec may
    // declare a structure, and the two keyings cannot interleave down a tree
    // either — so a guard that inspected only the direct children would pass
    // exactly the declaration the next migration step adds.
    const inner: ClaimMemberSpec = {
      domain: "actor",
      spec: SYNTHETIC_SPEC,
      wire: { jose: wireName("actor"), cose: wireName("actor") },
      codec: {
        kind: "object",
        children: () => [labelledMember("sub", 2)],
        open: "verbatim",
      },
      whenEmpty: "keep",
      sample: {},
    };

    try {
      shapeForObject("outer", [textMember("iss"), inner], "single");
      expect.unreachable("the guard did not throw");
    } catch (error) {
      // The PATH, not the leaf name: at depth, "sub" alone does not locate it.
      expect((error as CoseError).data).toEqual({
        claim: "outer",
        labelled: ["actor.sub"],
        textKeyed: ["iss", "actor"],
      });
    }
  });

  test("a SELF-REFERENTIAL member set terminates instead of recursing forever", () => {
    // RFC 8693 §4.1 defines the actor chain recursively — an `act` contains an
    // `act` — so the walk must key its visited set on the `children` THUNK, which
    // is the same function object every time. Keying on the returned array would
    // not work: it is a fresh array per call, so the walk would never converge.
    const children = (): ReadonlyArray<ClaimMemberSpec> => [
      textMember("iss"),
      {
        domain: "act",
        spec: SYNTHETIC_SPEC,
        wire: { jose: wireName("act"), cose: wireName("act") },
        codec: { kind: "object", children, open: "verbatim" },
        whenEmpty: "keep",
        sample: {},
      },
    ];

    // Terminating at all IS the assertion; an unguarded walk overflows the stack.
    expect(shapeForObject("act", children(), "single")).toEqual(VERBATIM_FIELD);
  });

  test("a self-referential set that is MIXED is still refused", () => {
    // The termination guard must not become a way for a half-migrated member set
    // to slip through: the cycle is cut, the mixture is still reported.
    const children = (): ReadonlyArray<ClaimMemberSpec> => [
      labelledMember("sub", 2),
      {
        domain: "act",
        spec: SYNTHETIC_SPEC,
        wire: { jose: wireName("act"), cose: wireName("act") },
        codec: { kind: "object", children, open: "verbatim" },
        whenEmpty: "keep",
        sample: {},
      },
    ];

    try {
      shapeForObject("synthetic", children(), "single");
      expect.unreachable("the guard did not throw");
    } catch (error) {
      // BOTH positions, and that is correct rather than duplication: the walk
      // reports every PATH at which a member sits, and `sub` and `act.sub` are
      // two of them. ⚠ It does NOT follow that a repair has to reach two
      // declarations — this fixture has only ONE `labelledMember("sub", 2)`,
      // reached twice through the self-reference, so one edit clears both lines.
      // What the two lines buy is the LOCATION: a report of "sub" alone would not
      // say that the member is also reachable one level down. The cycle guard
      // then stops the descent, so the list is finite — `act.act.sub` is not
      // reported.
      expect((error as CoseError).data).toEqual({
        claim: "synthetic",
        labelled: ["sub", "act.sub"],
        textKeyed: ["act", "act.act"],
      });
    }
  });

  test("a structured claim is ROUTED to the member-set shaper, labels and all", () => {
    // ⚠ THE ROUTING, not the shaper. `shapeForObject` refuses a labelled member
    // whether or not `fieldForClaim` still sends a structured claim to it, so a
    // guard that called the shaper directly would stay green through an edit
    // that stopped calling it. Entering at `fieldForClaim` is what makes the
    // wiring the thing under test — and the wiring is otherwise invisible,
    // because routing the collection arm to cbor's native `array` kind is
    // byte-identical on the wire.
    const labelledElement: ClaimSpec = {
      domain: "syntheticCollection",
      spec: SYNTHETIC_SPEC,
      wire: { jose: wireName("synthetic"), cose: wireName("synthetic") },
      codec: {
        kind: "array",
        of: {
          kind: "object",
          children: () => [textMember("iss"), labelledMember("sub", 2)],
          open: "verbatim",
        },
      },
      sensitivity: "public",
      bucket: "claims",
      whenEmpty: "keep",
      sample: [{ sub: "s" }],
    };

    try {
      fieldForClaim(labelledElement);
      expect.unreachable("the collection arm did not reach the member-set shaper");
    } catch (error) {
      expect((error as CoseError).data).toEqual({
        claim: "syntheticCollection",
        labelled: ["sub"],
        textKeyed: ["iss"],
      });
    }

    // …and the claim that really declares one builds the VERBATIM bespoke field
    // the shaper derives, never cbor's native `array` kind.
    const built = fieldForClaim(claimByDomain("authorizationDetails") as ClaimSpec);

    expect(built.kind).toBe("bespoke");
  });

  test("every structured claim the registry DECLARES has a shape", () => {
    // DERIVED from the registry, like both sibling guards: a claim that declares
    // children this builder cannot shape fails here rather than at mint time.
    //
    // ⚠ BOTH DECLARED FORMS, not just the single structure. A claim declaring an
    // array of structures reaches this builder through its ELEMENT, so a guard
    // that filtered on `kind === "object"` alone would stop covering the claim
    // the moment it migrated — which is the shape of a derived guard that quietly
    // narrows as the thing it derives from grows.
    // ⚠ THE FORM TRAVELS WITH THE MEMBER SET. A collection's element set and a
    // single structure's member set look identical here, and the compact encoder
    // does DIFFERENT things with them — so a guard that assumed one form would
    // exercise the wrong arm for half the registry.
    const structured = CLAIM_SPECS.map((spec) => {
      const codec = spec.codec;

      if (codec.kind === "object")
        return [spec.domain, codec.children, "single"] as const;
      if (codec.kind === "array" && codec.of !== undefined) {
        return [spec.domain, codec.of.children, "collection"] as const;
      }

      return [spec.domain, undefined, "single"] as const;
    }).filter(
      (
        entry,
      ): entry is readonly [
        string,
        () => ReadonlyArray<ClaimMemberSpec>,
        StructureForm,
      ] => entry[1] !== undefined,
    );

    // Registry order, with each claim's DECLARED form. `act` and `mayAct` share
    // ONE member set and are listed separately anyway: the shape is derived per
    // CLAIM, so two claims naming the same array is a fact worth being able to
    // see break.
    expect(structured.map(([domain, , form]) => [domain, form])).toEqual([
      ["act", "single"],
      ["authorizationDetails", "collection"],
      ["mayAct", "single"],
      // ⭐ `subjectId` is `"single"` at the CLAIM level and a COLLECTION one level
      // in: RFC 9493 §3.2.8's `identifiers` is an array of Subject Identifiers, so
      // the collection arm is reached through the member set rather than through
      // this table. That is the one shape `authorizationDetails` cannot exercise —
      // its element members are text-keyed, so it never reaches the compact arm.
      ["subjectId", "single"],
      ["address", "single"],
    ]);

    for (const [domain, children, form] of structured) {
      expect(
        () => shapeForObject(domain, children(), form),
        `no COSE shape for "${domain}"`,
      ).not.toThrow();
    }
  });

  test("a COLLECTION of all-labelled elements compacts EVERY element, not the array", () => {
    // ⚠⚠ THE REGRESSION THIS EXISTS FOR PUT AN EMPTY MAP ON A SIGNED TOKEN.
    // `fieldForClaim`'s `array` arm hands the ELEMENT member set to this builder,
    // and the compact encoder used to receive the whole ARRAY as if it were one
    // structure: it matched no member and returned `Map(0) {}`, so the claim
    // reached the wire saying nothing at all — in `proprietary` mode only, and
    // with every round trip through this package agreeing with itself.
    //
    // No REGISTERED claim reaches it yet (`authorizationDetails`'s one declared
    // member is text-keyed, so it takes the verbatim arm), but RFC 9493
    // `sub_id.identifiers` is an array of self and is exactly this shape.
    const field = shapeForObject(
      "syntheticCollection",
      [labelledMember("sub", 2), labelledMember("iss", 1)],
      "collection",
    );
    const value = [{ sub: "a", iss: "b" }, { sub: "c" }];

    const compact = field.encode?.(value as never, { proprietary: true } as never);

    expect(compact).toEqual([
      new Map<number, unknown>([
        [2, "a"],
        [1, "b"],
      ]),
      new Map<number, unknown>([[2, "c"]]),
    ]);

    // …and back, so the two halves are one codec rather than two.
    expect(field.decode?.(compact as never)).toEqual(value);
  });
});
