import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

/**
 * ⭐ `format` IS THE TOKEN'S OWN KIND; `wrapper` IS WHAT ENCLOSES IT.
 *
 * A caller asking "what is this token" gets the SAME answer whether or not it
 * was encrypted — an encrypted id_token is an id_token. The envelope moves to
 * `wrapper`, which is absent when nothing encloses the token.
 *
 * ⚠ `"jwe"` APPEARS IN BOTH SHAPES AND THE PRESENCE OF `wrapper` IS THE WHOLE
 * DISCRIMINATOR. A sign-then-encrypt is `{ format: "jwt", wrapper: "jwe" }`; a
 * BARE `aegis.encrypt` is `{ format: "jwe" }` with no wrapper, because its own
 * kind IS `jwe` and nothing wraps it. Reading `format === "jwe"` alone therefore
 * tells a caller nothing about whether a signed token is inside.
 */
describe("format is the token's own kind, wrapper is the envelope", () => {
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
    amphora.add(TEST_OCT_KEY_ENC);
  });

  const ID_TOKEN = { subject: "user-1", audience: ["client-1"] } as never;
  const CONTEXT = { context: { accessTokenIssued: false } };

  test.each([
    ["jwt", "jwe"],
    ["cwt", "cwe"],
  ] as const)(
    "a %s inside a %s reports the inner kind at mint",
    async (format, wrapper) => {
      const minted = await aegis.mint("id_token", ID_TOKEN, {
        format,
        ...CONTEXT,
        encrypt: { key: { kryptos: TEST_OCT_KEY_ENC } },
      } as never);

      expect(minted.format).toBe(format);
      expect(minted.wrapper).toBe(wrapper);
    },
  );

  test.each([
    ["jwt", "jwe"],
    ["cwt", "cwe"],
  ] as const)(
    "a %s inside a %s reports the inner kind at verify",
    async (format, wrapper) => {
      const minted = await aegis.mint("id_token", ID_TOKEN, {
        format,
        ...CONTEXT,
        encrypt: { key: { kryptos: TEST_OCT_KEY_ENC } },
      } as never);

      const verified = await aegis.verify(minted.token, undefined, {
        audience: "client-1",
      } as never);

      expect(verified.format).toBe(format);
      expect(verified.wrapper).toBe(wrapper);
    },
  );

  // The SAME token kind, encrypted and not — the property the change exists for.
  test.each(["jwt", "cwt"] as const)(
    "an unencrypted %s reports the same format and NO wrapper",
    async (format) => {
      const minted = await aegis.mint("id_token", ID_TOKEN, {
        format,
        ...CONTEXT,
      } as never);

      expect(minted.format).toBe(format);
      expect(minted.wrapper).toBeUndefined();
    },
  );

  /**
   * The BARE encrypted token: `aegis.encrypt` seals content, so there is no
   * inner token and nothing encloses the result. Its own kind IS the encrypting
   * format — which is why `format` alone cannot answer "is a signed token
   * inside".
   */
  test.each(["jwe", "cwe"] as const)(
    "a bare %s reports its own format",
    async (format) => {
      const encrypted = await aegis.encrypt(
        { subject: "user-1" } as never,
        {
          format,
        } as never,
      );

      expect(encrypted.format).toBe(format);
      expect(encrypted).not.toHaveProperty("wrapper");
    },
  );
});
