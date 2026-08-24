import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { inspectToken } from "../../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC_CBC } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * What the PROFILED MINT hands the sign-then-encrypt outer.
 *
 * The envelope travels whole, so most of it needs no test here — a dropped field
 * is what the knob probes measure, by minting twice and requiring the two
 * artifacts to differ. `proprietary` is the exception: it is the ONE value both
 * altitudes can state, so mint resolves a precedence, and a precedence is not
 * something a single-knob probe can see. Swapping these two operands, or dropping
 * the fallback outright, leaves every other test in the package green.
 *
 * AES-CBC-HMAC is the instrument. It has no IANA COSE `enc` value, so aegis emits
 * it under a lindorm private-use label and the interop gate is what permits it at
 * all — which makes "was the flag read?" a mint-or-refuse verdict rather than a
 * header comparison. RFC 9053 §4.
 */
describe("mintToken — the encrypt envelope's own interop flag", () => {
  let aegis: Aegis;

  const CONTENT = { subject: "user-1", audience: ["client-1"] };
  const CBC = { key: { condition: { id: TEST_OCT_KEY_ENC_CBC.id } } };

  /**
   * The outer's content-encryption label. `A128CBC-HS256` has no IANA COSE `enc`
   * value, so aegis writes the lindorm private-use `-65537`
   * (`internal/cose/enc-labels.ts#const ENC_TO_COSE_PRIVATE`) — which is the label
   * the gate exists to permit, and therefore the only success assertion that says
   * WHICH path let the mint through rather than merely that it did not throw.
   * RFC 9053 §4, RFC 8152 §16.2.
   */
  const outerEnc = (token: string): unknown => {
    const wire = inspectToken(token);
    if (wire.wire !== "cose") throw new Error("expected a COSE token");
    return wire.protectedHeader.get(1);
  };

  const mint = (encrypt: object, proprietary?: boolean): Promise<{ token: string }> =>
    aegis.mint(
      "id_token",
      CONTENT as never,
      {
        context: { accessTokenIssued: false },
        encrypt,
        format: "cwt",
        proprietary,
      } as never,
    );

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({
      internal: { issuer: "https://test.lindorm.io/" },
      logger,
    });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
    amphora.add(TEST_OCT_KEY_ENC_CBC);
  });

  // The floor: without the gate open at either altitude the outer is REFUSED, so
  // the three cases below are verdicts and not vacuous successes.
  test("neither altitude opens the gate, so the outer is refused", async () => {
    await expect(mint(CBC)).rejects.toMatchObject({ code: "cose_enc_not_registered" });
  });

  test("the mint-level flag reaches the outer when the envelope states nothing", async () => {
    expect(outerEnc((await mint(CBC, true)).token)).toBe(-65537);
  });

  test("the envelope's own flag opens the gate with no mint-level flag set", async () => {
    expect(outerEnc((await mint({ ...CBC, proprietary: true })).token)).toBe(-65537);
  });

  /**
   * ⭐ THE PRECEDENCE, and the only case that tells the two orderings apart. A
   * deployment sealing an interoperable inner token in an on-platform outer states
   * the two differently on purpose, so the envelope's answer about THIS outer must
   * beat the pipeline default rather than the other way round.
   */
  test("the envelope's flag beats the mint-level default when they disagree", async () => {
    await expect(mint({ ...CBC, proprietary: false }, true)).rejects.toMatchObject({
      code: "cose_enc_not_registered",
    });
  });
});
