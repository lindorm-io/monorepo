import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { inspectToken, type CoseInspection } from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

// The fixture keys are dated, and amphora refuses an expired one — the same
// clock every other suite over these keys pins.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/** RFC 9052 §3.1, Table 3 — `cty` is label 3 on the COSE wire. */
const COSE_CTY = 3;

/**
 * WHAT AN OPAQUE SIGNATURE HANDS BACK IS WHAT IT WAS GIVEN — on BOTH wires.
 *
 * `aegis.jws.sign` / `aegis.cws.sign` take a JS value, and the shape a caller
 * signed is the shape `verify` returns: a Dict in, a Dict out; a string in, a string out; a Buffer
 * in, a Buffer out. The content type is what carries that across the wire, so
 * the emitted `cty` is asserted beside every round trip — a payload that came
 * back right under a `cty` that says something else would be right by accident.
 *
 * This is the same contract `@lindorm/aes` has always had: hand its encrypt an
 * object and `calculateContentType` writes `application/json`, and its decrypt
 * resolves an object back. Aegis uses and honours `cty` the same way.
 *
 * The rows below assert the two wires AGREE, which is the property a single-wire
 * read cannot establish: two wires that each round-trip faithfully into a
 * DIFFERENT shape both look self-consistent.
 *
 * ⚠ `aegis.sign` is claims-only and reaches none of this — an opaque signature is
 * these two namespaces. Their bag is the kits' own, so it is WIRE-named (`cty`,
 * not the domain `contentType`).
 *
 * `aegis.parse` is deliberately absent: it is a CLAIMS reader and throws for the
 * opaque formats, so `verify` is the only read of an opaque payload.
 */
describe("what an opaque signature hands back", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: "https://test.lindorm.io/" }, logger });
    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_EC_KEY_SIG);
  });

  /**
   * The emitted content type, read back with the INDEPENDENT wire inspector
   * rather than through any aegis reader — a writer and a reader that changed
   * together would agree perfectly and prove nothing.
   */
  const ctyOf = (token: string): unknown => {
    const inspection = inspectToken(token);

    return inspection.wire === "jose"
      ? inspection.protectedHeader.cty
      : (inspection as CoseInspection).protectedHeader.get(COSE_CTY);
  };

  describe("a Dict payload", () => {
    test("comes back a Dict on the JOSE wire, declared application/json", async () => {
      const signed = await aegis.jws.sign({ hello: "world" });

      expect(ctyOf(signed.token)).toBe("application/json");

      await expect(aegis.verify(signed.token)).resolves.toEqual(
        expect.objectContaining({ format: "jws", raw: { hello: "world" } }),
      );
    });

    test("comes back a Dict on the COSE wire, declared application/json", async () => {
      const signed = await aegis.cws.sign({ hello: "world" });

      expect(ctyOf(signed.token)).toBe("application/json");

      await expect(aegis.verify(signed.token)).resolves.toEqual(
        expect.objectContaining({ format: "cws", raw: { hello: "world" } }),
      );
    });

    // THE POINT OF THE ROUND. The two assertions above could both be satisfied
    // by two wires that each round-trip faithfully into a different shape; this
    // one cannot.
    test("comes back as the SAME value on both wires", async () => {
      const payload = { hello: "world", nested: { depth: 1 }, list: [1, 2, 3] };

      const jose = await aegis.jws.sign(payload);
      const cose = await aegis.cws.sign(payload);

      const verifiedJose = await aegis.verify(jose.token);
      const verifiedCose = await aegis.verify(cose.token);

      expect(verifiedJose.raw).toEqual(payload);
      expect(verifiedCose.raw).toEqual(verifiedJose.raw);
      expect(ctyOf(cose.token)).toBe(ctyOf(jose.token));
    });
  });

  // The two OPAQUE shapes, which the change must leave exactly where they were:
  // a string and a Buffer have one natural wire form on either family, so there
  // is nothing for the wire to decide and no reason for the two to differ.
  describe("an opaque payload is untouched", () => {
    test("a string round-trips as a string on both wires", async () => {
      const jose = await aegis.jws.sign("an opaque string");
      const cose = await aegis.cws.sign("an opaque string");

      expect(ctyOf(jose.token)).toBe("text/plain");
      expect(ctyOf(cose.token)).toBe("text/plain");

      await expect(aegis.verify(jose.token)).resolves.toEqual(
        expect.objectContaining({ raw: "an opaque string" }),
      );
      await expect(aegis.verify(cose.token)).resolves.toEqual(
        expect.objectContaining({ raw: "an opaque string" }),
      );
    });

    test("a Buffer round-trips as a Buffer on both wires", async () => {
      const payload = Buffer.from([0xca, 0xfe, 0xba, 0xbe]);

      const jose = await aegis.jws.sign(payload);
      const cose = await aegis.cws.sign(payload);

      expect(ctyOf(jose.token)).toBe("application/octet-stream");
      expect(ctyOf(cose.token)).toBe("application/octet-stream");

      await expect(aegis.verify(jose.token)).resolves.toEqual(
        expect.objectContaining({ raw: payload }),
      );
      await expect(aegis.verify(cose.token)).resolves.toEqual(
        expect.objectContaining({ raw: payload }),
      );
    });
  });

  /**
   * ⭐ THE OTHER THREE DECLARED PAYLOAD TYPES. `TokenContent` is
   * `Array<any> | boolean | Buffer | Dict | number | string`, and
   * `IAegisJws.sign` / `IAegisCws.sign` accept every member — so every member
   * has to survive the trip.
   *
   * ⚠ They are here because the emission normalisation is written for CLAIM
   * DICTS and reaches this door: `omitUndefined` throws a raw `TypeError` on a
   * scalar, and `pruneEmptyClaims` rebuilds through `Object.entries`, so an array
   * handed to it comes back `{"0":1,"1":2,"2":3}` — a silently different payload
   * under a `cty` that still says what the caller meant. Nothing above the
   * `isObject` guard in `raw-sign-jws.ts` / `raw-sign-cose.ts` keeps them out.
   */
  describe("every other declared payload type", () => {
    test.each([
      ["a number", 42, "application/json"],
      ["a boolean", true, "application/json"],
      ["an array", [1, 2, 3], "application/json"],
    ] as const)("%s round-trips unchanged on both wires", async (_name, payload, cty) => {
      const jose = await aegis.jws.sign(payload as never);
      const cose = await aegis.cws.sign(payload as never);

      expect(ctyOf(jose.token)).toBe(cty);
      expect(ctyOf(cose.token)).toBe(cty);

      await expect(aegis.verify(jose.token)).resolves.toEqual(
        expect.objectContaining({ raw: payload }),
      );
      await expect(aegis.verify(cose.token)).resolves.toEqual(
        expect.objectContaining({ raw: payload }),
      );
    });

    // The array case stated on its own, because the failure it guards against is
    // not a throw: an array rebuilt as an object round-trips CLEANLY into the
    // wrong shape, so only comparing against the array catches it.
    test("an array does not come back an object", async () => {
      const { raw } = await aegis.verify((await aegis.jws.sign([1, 2, 3])).token);

      expect(Array.isArray(raw)).toBe(true);
      expect(raw).not.toEqual({ 0: 1, 1: 2, 2: 3 });
    });
  });

  /**
   * `cty` is NOT reserved — it declares a NESTED token (RFC 7519 §5.2,
   * RFC 8392 Appendix A.6) — so the inferred label is a DEFAULT and a caller
   * must be able to override it. A wire that stamped the inferred type over a
   * stated one would take the nesting declaration away with it.
   */
  describe("a caller-set cty wins", () => {
    test("on the JOSE wire", async () => {
      // The kit bag is WIRE-named: `cty`, not the domain `contentType`.
      const signed = await aegis.jws.sign(
        { hello: "world" },
        { header: { cty: "application/example+json" } },
      );

      expect(ctyOf(signed.token)).toBe("application/example+json");
    });

    test("on the COSE wire", async () => {
      const signed = await aegis.cws.sign(
        { hello: "world" },
        { header: { cty: "application/example+json" } },
      );

      expect(ctyOf(signed.token)).toBe("application/example+json");
    });
  });

  /**
   * The emission normalisation reaches a PLAIN OBJECT payload on both wires and
   * leaves every other `TokenContent` member alone.
   *
   * Each wire applies it in its OWN raw signer — `raw-sign-jws.ts` and
   * `raw-sign-cose.ts` — at the same depth, spelled identically. They are still
   * two separate call sites, so either can be dropped on its own; that the two
   * agree is what these rows assert, and the rows above prove the agreement
   * extends to the members the normalisation must NOT touch.
   *
   * ⚠ An OPAQUE payload is the caller's data, so what the normalisation may take
   * out of it is narrow by construction: `undefined`, and the empty value of a
   * claim aegis has DECLARED. `nonce` is the declared one — the registry prunes
   * it when empty — and `empty` is not a claim at all, so it is never touched on
   * either wire. That pairing is the property that keeps this door honest now
   * that nothing has to be asked for.
   */
  describe("the emission normalisation reaches an object payload", () => {
    test("and prunes the declared empty claim on both wires", async () => {
      const payload = { kept: "value", nonce: "", empty: [] };

      const jose = await aegis.jws.sign(payload);
      const cose = await aegis.cws.sign(payload);

      await expect(aegis.verify(jose.token)).resolves.toEqual(
        expect.objectContaining({ raw: { kept: "value", empty: [] } }),
      );
      await expect(aegis.verify(cose.token)).resolves.toEqual(
        expect.objectContaining({ raw: { kept: "value", empty: [] } }),
      );
    });

    test("and drops an undefined entry on both wires", async () => {
      const payload = { kept: "value", gone: undefined };

      const jose = await aegis.jws.sign(payload);
      const cose = await aegis.cws.sign(payload);

      await expect(aegis.verify(jose.token)).resolves.toEqual(
        expect.objectContaining({ raw: { kept: "value" } }),
      );
      await expect(aegis.verify(cose.token)).resolves.toEqual(
        expect.objectContaining({ raw: { kept: "value" } }),
      );
    });
  });
});
