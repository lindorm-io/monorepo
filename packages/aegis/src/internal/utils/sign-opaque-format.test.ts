import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { inspectToken } from "../../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { Aegis } from "../../classes/Aegis.js";
import type { TokenFormat } from "../../types/index.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * Which WIRE `aegis.sign` reaches for each write format it accepts — the
 * capability boundary of the opaque sign verb.
 *
 * It used to be the tail of a ladder: `if (format === "cws")` signed a COSE_Sign1
 * and EVERYTHING else fell through to the JWS signer, `cwt` and `cwm` included.
 * That fall-through is now a total record (`SIGN_OPAQUE_FORMAT`), and a total
 * record is only an improvement while something states what it must contain —
 * otherwise the verb has silently gained, or lost, a wire the day someone edits
 * a line.
 *
 * ⛔ `cwt`/`cwm` answering with a JWS is PRESERVED BEHAVIOUR, not an endorsement.
 * A claims-bearing COSE structure from the OPAQUE verb would be a new capability
 * and is tracked separately; these rows exist so that adding it is a deliberate,
 * visible change rather than a side effect.
 */
describe("aegis.sign — the wire each write format reaches", () => {
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

  // The wire is read off the TOKEN by the independent inspector, not off the
  // reported format: a `format` field is aegis describing itself, where the dot
  // structure is what a foreign reader actually sees.
  const wireOf = async (format?: TokenFormat): Promise<[string, string]> => {
    const signed = await aegis.sign({ payload: { kept: "yes" }, format });
    return [signed.format, inspectToken(signed.token).wire];
  };

  test("an unstated format signs a JWS", async () => {
    await expect(wireOf()).resolves.toEqual(["jws", "jose"]);
  });

  test.each(["jws", "jwt"] as const)("%s signs a JWS", async (format) => {
    await expect(wireOf(format)).resolves.toEqual(["jws", "jose"]);
  });

  test("cws signs a COSE_Sign1 — the ONE format that reaches the COSE wire", async () => {
    await expect(wireOf("cws")).resolves.toEqual(["cws", "cose"]);
  });

  test.each(["cwt", "cwm"] as const)(
    "%s signs a JWS — the preserved fall-through, NOT a COSE token",
    async (format) => {
      await expect(wireOf(format)).resolves.toEqual(["jws", "jose"]);
    },
  );
});
