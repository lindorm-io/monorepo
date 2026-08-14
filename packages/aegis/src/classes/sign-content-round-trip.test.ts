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
 * WHAT `aegis.sign` HANDS BACK IS WHAT IT WAS GIVEN — on BOTH wires.
 *
 * The domain verb takes a JS value, and the shape a caller signed is the shape
 * `verify` returns: a Dict in, a Dict out; a string in, a string out; a Buffer
 * in, a Buffer out. The content type is what carries that across the wire, so
 * the emitted `cty` is asserted beside every round trip — a payload that came
 * back right under a `cty` that says something else would be right by accident.
 *
 * This is the same contract `@lindorm/aes` has always had: hand its encrypt an
 * object and `calculateContentType` writes `application/json`, and its decrypt
 * resolves an object back. Aegis uses and honours `cty` the same way.
 *
 * ⚠ The JOSE wire used to JSON-STRINGIFY an object before signing it, so
 * `sign({ payload: { hello: "world" } , format: "jws" })` emitted
 * `cty: text/plain` and `verify` handed back the STRING `{"hello":"world"}`,
 * while the COSE twin handed back the object. Same domain call, two shapes. The
 * rows below assert the two wires AGREE, which is the property that was missing
 * — either wire read alone would have looked self-consistent.
 *
 * ⚠ These exercise the DOMAIN verb (`aegis.sign`), not the kits. The kit tier
 * has always passed an object through, which is why the scenario table's
 * `via: "kit-sign"` opaque rows were green throughout the defect: the table has
 * no artifact for the `sign` verb, so nothing above the kits was watching.
 *
 * `aegis.parse` is deliberately absent: it is a CLAIMS reader and throws for the
 * opaque formats, so `verify` is the only read of an opaque payload.
 */
describe("what aegis.sign hands back", () => {
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
      const signed = await aegis.sign({ payload: { hello: "world" }, format: "jws" });

      expect(ctyOf(signed.token)).toBe("application/json");

      await expect(aegis.verify(signed.token)).resolves.toEqual(
        expect.objectContaining({ format: "jws", raw: { hello: "world" } }),
      );
    });

    test("comes back a Dict on the COSE wire, declared application/json", async () => {
      const signed = await aegis.sign({ payload: { hello: "world" }, format: "cws" });

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

      const jose = await aegis.sign({ payload, format: "jws" });
      const cose = await aegis.sign({ payload, format: "cws" });

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
      const jose = await aegis.sign({ payload: "an opaque string", format: "jws" });
      const cose = await aegis.sign({ payload: "an opaque string", format: "cws" });

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

      const jose = await aegis.sign({ payload, format: "jws" });
      const cose = await aegis.sign({ payload, format: "cws" });

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
   * `cty` is NOT reserved — RFC 7519 §5.2 and RFC 8392 Appendix A.6 both use it
   * to declare a NESTED token — so the inferred label is a DEFAULT and a caller
   * must be able to override it. A wire that stamped the inferred type over a
   * stated one would take the nesting declaration away with it.
   */
  describe("a caller-set cty wins", () => {
    test("on the JOSE wire", async () => {
      const signed = await aegis.sign({
        payload: { hello: "world" },
        format: "jws",
        header: { contentType: "application/example+json" },
      });

      expect(ctyOf(signed.token)).toBe("application/example+json");
    });

    test("on the COSE wire", async () => {
      const signed = await aegis.sign({
        payload: { hello: "world" },
        format: "cws",
        header: { contentType: "application/example+json" },
      });

      expect(ctyOf(signed.token)).toBe("application/example+json");
    });
  });

  /**
   * The empty-claim prune reaches an OBJECT payload on both wires and leaves a
   * string/Buffer alone — the property the stringify used to carry on the JOSE
   * side and which had to survive its deletion. It is applied at a different
   * DEPTH on each wire (the JOSE wire itself, the shared COSE signer) because
   * `aegis.jws.sign` declares no `omit` option while `aegis.cws.sign` does; the
   * expression and its default are the same, which is what these assert.
   */
  describe("the empty-claim prune reaches an object payload", () => {
    test("on both wires by default", async () => {
      const payload = { kept: "value", dropped: "", empty: [] };

      const jose = await aegis.sign({ payload, format: "jws" });
      const cose = await aegis.sign({ payload, format: "cws" });

      await expect(aegis.verify(jose.token)).resolves.toEqual(
        expect.objectContaining({ raw: { kept: "value" } }),
      );
      await expect(aegis.verify(cose.token)).resolves.toEqual(
        expect.objectContaining({ raw: { kept: "value" } }),
      );
    });

    test("and honours the undefined-only mode on both wires", async () => {
      const payload = { kept: "value", dropped: "", gone: undefined };

      const jose = await aegis.sign({ payload, format: "jws", omit: "undefined" });
      const cose = await aegis.sign({ payload, format: "cws", omit: "undefined" });

      await expect(aegis.verify(jose.token)).resolves.toEqual(
        expect.objectContaining({ raw: { kept: "value", dropped: "" } }),
      );
      await expect(aegis.verify(cose.token)).resolves.toEqual(
        expect.objectContaining({ raw: { kept: "value", dropped: "" } }),
      );
    });
  });
});
