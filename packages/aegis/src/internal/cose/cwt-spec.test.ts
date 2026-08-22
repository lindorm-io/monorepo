import { SYNTHETIC_SPEC } from "../../__fixtures__/synthetic-spec.js";
import { describe, expect, test } from "vitest";
import { CwtKit } from "../../classes/CwtKit.js";
import { CoseError } from "../../errors/index.js";
import { CLAIM_SPECS, type ClaimSpec, claimByDomain } from "../claims/claims-registry.js";
import type { BespokeKind, ClaimMemberSpec } from "../registry/claim-spec.js";
import { codecFor } from "../registry/param-spec.js";
import { wireLabel, wireName } from "../registry/wire-key.js";
import { encodeCbor, Tag } from "./cbor.js";
import { coseByJose } from "../header/header-registry.js";
import { COSE_TAG, encodeProtectedHeader } from "./structures.js";
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
 * ⚠ The protection has two halves and only the RUNTIME one is testable — a
 * sub-kind with no arm throws rather than returning an identity codec. The
 * COMPILE-TIME half (`const exhaustive: never = bespoke`) cannot be asserted by a
 * test: writing one means adding the member to the very union whose
 * exhaustiveness is the property.
 */
describe("shapeForBespoke — the CWT claim shaper's drift guard", () => {
  test("a sub-kind with no arm THROWS rather than shipping an unshaped value", () => {
    // ⚠ The cast stays on this line. Adding a `"__test"` member to `BespokeKind`
    // would type-check the call and ship a fake sub-kind inside the union the
    // guard exists to keep exhaustive.
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
    // DERIVED from the registry, not a hand-written list: a claim declaring a
    // sub-kind with no arm fails here at runtime, naming the kind.
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
    // Keyed by KIND, the only thing the function takes: a second claim declaring
    // an existing sub-kind under a new domain name cannot fall through.
    expect(shapeForBespoke("confirmation").kind).toBe("bespoke");
    expect(shapeForBespoke("events").kind).toBe("bespoke");
  });

  test("the verbatim sub-kind still carries its value through untouched", () => {
    // A declared structure resolves through `shapeForObject`, which derives the
    // same verdict from the member set; `events` is the one named here.
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
 * ⚠ `encoding` on a registry `bstr` codec is a SELECTOR for a `CborField` shape,
 * not a value forwarded under the same name — the two encodings resolve to two
 * different field shapes, and this file is where that stays true.
 */
describe("shapeForBstr — the CWT byte-encoding shaper's drift guard", () => {
  test("an encoding with no arm THROWS rather than shipping an unshaped value", () => {
    // ⚠ The cast stays on these two lines, for the reason the sibling guard above
    // states: a `"__test"` member in the union would type-check the call.
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

    // cbor has no native kind for a string's own bytes, so "utf8" is bespoke.
    expect(utf8.kind).toBe("bespoke");
    expect(utf8.encode?.("AAA", { proprietary: false })).toEqual(Buffer.from("AAA"));
    expect(utf8.decode?.(Buffer.from("AAA"))).toBe("AAA");

    // cbor's native bstr kind takes no encode/decode pair.
    expect(b64u).toEqual({ kind: "bstr", encoding: "b64u" });

    // The consequence in bytes: one 4-char domain string, two lengths.
    expect((utf8.encode?.("QUJD", { proprietary: false }) as Buffer).length).toBe(4);
    expect(Buffer.from("QUJD", "base64url").length).toBe(3);
  });
});

/**
 * The STRUCTURE shaper's drift guard. `shapeForObject` derives a claim's COSE
 * shape from its member set — one input, how the members are keyed.
 *
 * ⚠ The refusal is the interesting half: a MIXED set throws as a migration guard,
 * so a half-labelled member set cannot freeze a halfway migration onto a signed
 * wire. `cwt-spec.ts` states the reason.
 */
describe("shapeForObject — the CWT structure shaper's drift guard", () => {
  // ⚠ The synthetic structures below state `open: "verbatim"` and the shaper never
  // reads it — `ObjectCodec.open` is a required cell, and the compact spec is
  // derived from the members' labels alone. The value mirrors what the registered
  // structures these stand in for declare, so it stays true if the cell ever does
  // reach the COSE side.
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
    // The arm the RFC 8693 actor chain takes: the label table is DERIVED from the
    // member declarations, so there is no second copy for the wire to disagree with.
    const field = shapeForObject(
      "synthetic",
      [labelledMember("iss", 1), labelledMember("sub", 2)],
      "single",
    );
    const value = { iss: "https://issuer.test", sub: "user-1" };

    expect(field.kind).toBe("bespoke");

    // ⚠ BOTH modes: member labels are assigned by this registry alone, so an
    // interoperable token keeps the string-keyed structure and only an
    // on-platform one collapses to integers. Asserting one half alone is
    // satisfied by a shaper that ignored the option entirely.
    expect(field.encode?.(value, { proprietary: false })).toBe(value);
    expect(field.encode?.(value, { proprietary: true })).toEqual(
      new Map<number, unknown>([
        [1, "https://issuer.test"],
        [2, "user-1"],
      ]),
    );

    // …and back, keyed by the string fallback the labels carry — the vocabulary
    // the translator reads a structure in.
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
    // `CompactSpec.nested` takes a THUNK, so the derived spec builds one level per
    // level of DATA and terminates with the value, not the declaration — the only
    // way a self-referential member set compacts at all.
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

    // Three levels: a spec that compacted only the top leaves the inner actors
    // string-keyed, and a round trip through this package still agrees with itself.
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
      // Members on BOTH sides, not merely the claim: which side a member sits on
      // is what makes the refusal actionable — label the one, or unlabel the other.
      expect((error as CoseError).data).toEqual({
        claim: "synthetic",
        labelled: ["sub"],
        textKeyed: ["iss"],
      });
    }
  });

  test("a labelled member NESTED inside a text-keyed structure is refused too", () => {
    // ⚠ The case a one-level guard is silent about: a guard inspecting only the
    // direct children passes exactly the declaration a migration step adds next.
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
    // RFC 8693 §4.1. The walk keys its visited set on the `children` THUNK — the
    // same function object every time; the returned array is fresh per call, so
    // keying on that never converges.
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
      // Every PATH at which a member sits, not one entry per declaration: this
      // fixture holds ONE `labelledMember("sub", 2)` reached twice, so one edit
      // clears both lines. The cycle guard keeps the list finite.
      expect((error as CoseError).data).toEqual({
        claim: "synthetic",
        labelled: ["sub", "act.sub"],
        textKeyed: ["act", "act.act"],
      });
    }
  });

  test("a structured claim is ROUTED to the member-set shaper, labels and all", () => {
    // ⚠ THE ROUTING, not the shaper: `shapeForObject` refuses a labelled member
    // whether or not `fieldForClaim` still sends a structured claim to it, so a
    // guard calling the shaper directly stays green through an edit that stops
    // calling it. The routing is otherwise invisible — the collection arm and
    // cbor's native `array` kind are byte-identical on the wire.
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

    // …and a claim that really declares one builds the verbatim bespoke field the
    // shaper derives, never cbor's native `array` kind.
    const built = fieldForClaim(claimByDomain("authorizationDetails") as ClaimSpec);

    expect(built.kind).toBe("bespoke");
  });

  test("every structured claim the registry DECLARES has a shape", () => {
    // DERIVED from the registry, like both sibling guards: a claim declaring
    // children this builder cannot shape fails here rather than at mint time.
    //
    // ⚠ BOTH declared forms. An array of structures reaches this builder through
    // its ELEMENT, so filtering on `kind === "object"` alone silently stops
    // covering a claim the moment it migrates — and the FORM travels with the
    // member set, because the two sets look identical here while the compact
    // encoder does different things with them.
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

    // Registry order, with each claim's DECLARED form. `act` and `mayAct` share one
    // member set and are listed separately: the shape is derived per CLAIM.
    expect(structured.map(([domain, , form]) => [domain, form])).toEqual([
      ["act", "single"],
      ["authorizationDetails", "collection"],
      ["mayAct", "single"],
      // `subjectId` is "single" at the CLAIM level and a collection one level in
      // (RFC 9493 §3.2.8), so its collection arm is reached through the member set
      // rather than through this table.
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
    // ⚠ Handing the compact encoder the whole ARRAY matches no member and returns
    // `Map(0) {}` — an empty map on a signed token, in `proprietary` mode only,
    // with every round trip through this package still agreeing with itself.
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

/**
 * The `cti` type check, pinned at the door it escapes from. `CwtKit.decode` takes
 * no key and checks no signature, so the bytes are a stranger's, and a raw
 * `TypeError` out of `Buffer.from` is not an `AegisError` for a caller to catch.
 *
 * Pinned HERE, not on `decodeCti`: the property is that the refusal reaches the
 * public keyless door, and a test calling the codec directly cannot see whether
 * the door still runs it.
 */
describe("a foreign CWT whose cti is not a byte string", () => {
  // RFC 8392 §3.1.7
  const CTI_LABEL = 7;

  const foreignCwt = (cti: unknown): Buffer =>
    Buffer.from(
      encodeCbor(
        new Tag(
          COSE_TAG.cwt,
          new Tag(COSE_TAG.sign1, [
            encodeProtectedHeader(new Map<number, unknown>([[coseByJose("alg"), -7]])),
            new Map<number, unknown>(),
            encodeCbor(new Map<number | string, unknown>([[CTI_LABEL, cti]])),
            Buffer.alloc(8),
          ]),
        ),
      ),
    );

  test.each([
    ["an integer", 42],
    ["a text string", "not-a-bstr"],
    ["an array", [1, 2]],
    ["a map", new Map<number, unknown>([[1, 2]])],
    ["null", null],
  ])("a cti carried as %s is refused as a CoseError", (_name, cti) => {
    let thrown: unknown;
    try {
      CwtKit.decode(foreignCwt(cti));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CoseError);
    expect((thrown as CoseError).code).toBe("cose_malformed");
    expect((thrown as CoseError).data).toEqual({ claim: "cti", label: 7 });
  });

  test("a conformant byte-string cti still reads back as its UTF-8 string", () => {
    const token = foreignCwt(Buffer.from("cti_probe", "utf8"));

    expect(CwtKit.decode(token).payload.cti).toBe("cti_probe");
  });
});
