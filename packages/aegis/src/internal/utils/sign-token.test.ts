import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * `signToken` — the top-level `aegis.sign({ payload, … })` verb, beside this file.
 *
 * It is a THIRD door onto the prune mode: `mint` states it on the profile options,
 * the signing envelope states it as a per-sign fallback (both covered by the knob
 * matrix), and this verb states it on its own input. Each is a separate forward,
 * so each can be dropped separately.
 *
 * ⚠ Not a conformance row: the scenario table's artifact steps reach the profiled
 * mint and the raw kit namespaces, and this verb is neither — it takes a payload
 * rather than claims, and no `format` at all in its default form, which is the
 * case that matters most here.
 */
describe("signToken — the prune mode on the top-level sign verb", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({
      internal: { issuer: "https://test.lindorm.io/" },
      logger,
    });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  // The empty-claim vocabulary the mode governs, plus a real value that must
  // survive either way — without it a mode that dropped EVERYTHING would satisfy
  // the default case below.
  const PAYLOAD = { empty_list: [] as Array<string>, empty_text: "", kept: "yes" };

  const payloadOf = (token: string): Record<string, unknown> => {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  };

  test("prunes an empty claim by default", async () => {
    const { token } = await aegis.sign({ payload: { ...PAYLOAD } });
    const decoded = payloadOf(token);

    expect(decoded).not.toHaveProperty("empty_list");
    expect(decoded).not.toHaveProperty("empty_text");
    expect(decoded.kept).toBe("yes");
  });

  test("keeps an empty claim when the caller states the mode that keeps it", async () => {
    const { token } = await aegis.sign({ payload: { ...PAYLOAD }, omit: "undefined" });
    const decoded = payloadOf(token);

    expect(decoded.empty_list).toEqual([]);
    expect(decoded.empty_text).toBe("");
    expect(decoded.kept).toBe("yes");
  });
});
