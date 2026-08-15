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
 * It is a SEPARATE forward onto the emission-boundary normalisation: `mint`
 * reaches it through the claims wires, and this verb through `signOpaque`. Each
 * is its own call, so each can be dropped separately — and there is no longer an
 * option to state, so the only thing that can prove this one still runs is the
 * wire it produces.
 *
 * ⚠ Not a conformance row: the scenario table's artifact steps reach the profiled
 * mint and the raw kit namespaces, and this verb is neither — it takes a payload
 * rather than claims, and no `format` at all in its default form, which is the
 * case that matters most here.
 */
describe("signToken — the emission normalisation on the top-level sign verb", () => {
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

  // What the registry governs: a REGISTERED claim whose cell prunes when empty
  // (`nonce`), a registered claim whose cell keeps (`scope`), a key aegis has
  // never declared (`empty_list`), and a real value that must survive — without
  // it a normalisation that dropped EVERYTHING would satisfy the prune case
  // below.
  const PAYLOAD = {
    nonce: "",
    scope: [] as Array<string>,
    empty_list: [] as Array<string>,
    kept: "yes",
  };

  const payloadOf = (token: string): Record<string, unknown> => {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  };

  test("prunes the claim the registry declares prunable, with nothing asked for", async () => {
    const { token } = await aegis.sign({ payload: { ...PAYLOAD } });
    const decoded = payloadOf(token);

    expect(decoded).not.toHaveProperty("nonce");
    expect(decoded.kept).toBe("yes");
  });

  /**
   * The forward reaches the prune, and the prune still refuses to reshape what
   * aegis has not declared: `scope` is a registered claim the registry KEEPS when
   * empty, and `empty_list` is not a claim at all. A normalisation that took the
   * payload apart would take these with it.
   */
  test("prunes nothing else", async () => {
    const { token } = await aegis.sign({ payload: { ...PAYLOAD } });
    const decoded = payloadOf(token);

    expect(decoded.scope).toEqual([]);
    expect(decoded.empty_list).toEqual([]);
  });
});
