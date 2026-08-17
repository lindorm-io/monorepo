import { describe, expect, test } from "vitest";
import { CoseError } from "../../errors/index.js";
import { CLAIM_SPECS } from "../claims/claims-registry.js";
import type { BespokeKind } from "../registry/claim-spec.js";
import { codecFor } from "../registry/param-spec.js";
import { shapeForBespoke, shapeForBstr } from "./cwt-spec.js";

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
    expect(shapeForBespoke("confirmation").kind).toBe("bespoke");
    expect(shapeForBespoke("act").kind).toBe("bespoke");
    expect(shapeForBespoke("subId").kind).toBe("bespoke");
  });

  test("the three verbatim sub-kinds still carry their value through untouched", () => {
    // Behaviour PRESERVATION: `events`, `authDetails` and `address` reached the
    // identity codec by FALLING THROUGH the old chain and now reach it by being
    // named. The codec they get must be the same one.
    for (const bespoke of ["events", "authDetails", "address"] as const) {
      const field = shapeForBespoke(bespoke);
      const value = { any: ["shape", 1, true] };

      expect(field.kind).toBe("bespoke");
      expect(field.encode?.(value, { proprietary: false })).toBe(value);
      expect(field.decode?.(value)).toBe(value);
    }
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
