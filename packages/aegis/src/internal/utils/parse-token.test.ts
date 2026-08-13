import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../../__fixtures__/keys.js";
import { AegisError } from "../../errors/index.js";
import { Aegis } from "../../classes/Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * `parseToken` — the keyless, unverified claims read, beside this file.
 *
 * What it does with each token KIND is stated as conformance rows (a claims token
 * is read; an opaque one and an encrypted one are refused, each naming the format
 * it refused). Two things about it cannot be: both take an input no artifact step
 * can build, which is exactly why they are the two worth holding here.
 */
describe("parseToken", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  const content = { expires: "1h", subject: "user-1", tokenType: "test_token" } as const;

  // A string nobody signed. Every artifact step in the scenario table produces a
  // real token by construction, so this input is unreachable from a row — and it
  // is the input a caller is likeliest to arrive with, since it is whatever the
  // request actually carried.
  test("refuses a value that is not a token at all", () => {
    expect(() => aegis.parse("not-a-token")).toThrow(
      expect.objectContaining({ code: "unsupported_token_type" }),
    );
  });

  // The defining property of the verb, and the reason it exists as something
  // separate from verify. Stating it needs a token whose signature is BROKEN,
  // which no artifact step can build either — a row can only sign correctly.
  test("is UNVERIFIED — a token with a broken signature still parses", async () => {
    const { token } = await aegis.mint("default", content);
    const tampered = `${token.slice(0, -4)}AAAA`;

    const parsed = aegis.parse(tampered);

    expect(parsed.claims.subject).toBe("user-1");

    // …and the contrast is the whole point: the SAME token through the verb that
    // does check is refused. Without it, a parse that had silently started
    // verifying would be indistinguishable from one that never did, and a caller
    // relying on parse to inspect an untrusted token would be relying on nothing.
    await expect(aegis.verify(tampered, { audience: ISSUER })).rejects.toBeInstanceOf(
      AegisError,
    );
  });
});
