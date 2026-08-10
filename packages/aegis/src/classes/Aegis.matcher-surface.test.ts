import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { DefaultContent } from "../types/index.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

const ACCESS_TOKEN =
  "12ceb9251ddf52399fe62f122a45844865a83dcb52585fea90ae3448e0244ab0037950882d705675a4fe248e1c8d9f5c";
const AUTH_CODE = "999a8b01e27c56aeb5b2f47c001ef8be7be39a375f8c5e929f82df1626de01d8";
const AUTH_STATE = "7409ac52a9615b8c9f9a";

/**
 * A MATCHER asserts what must be true; an OPTION changes how the check runs. By
 * that test `tokenType` and the three hash-derive inputs were always matchers —
 * verify already read them out of the matcher bag internally — so they live on
 * the positional `assert` argument, not in the options object.
 */
describe("Aegis verify — the assert matcher surface", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_EC_KEY_SIG);
  });

  const baseContent: DefaultContent = {
    expires: "1h",
    subject: "3f2ae79d-f1d1-556b-a8bc-305e6b2334ad",
    tokenType: "test_token",
  };

  const mint = (content: DefaultContent) => aegis.mint("default", content);

  describe("hash-derive matchers", () => {
    test("should accept the raw access token from assert", async () => {
      const { token } = await mint({ ...baseContent, accessToken: ACCESS_TOKEN });

      await expect(
        aegis.verify(token, { accessToken: ACCESS_TOKEN }),
      ).resolves.toBeDefined();
    });

    test("should reject a raw access token that does not hash to at_hash", async () => {
      const { token } = await mint({ ...baseContent, accessToken: ACCESS_TOKEN });

      await expect(
        aegis.verify(token, { accessToken: "a-different-access-token" }),
      ).rejects.toThrow();
    });

    test("should accept all three raw sources from assert", async () => {
      const { token } = await mint({
        ...baseContent,
        accessToken: ACCESS_TOKEN,
        authCode: AUTH_CODE,
        authState: AUTH_STATE,
      });

      await expect(
        aegis.verify(token, {
          accessToken: ACCESS_TOKEN,
          authCode: AUTH_CODE,
          authState: AUTH_STATE,
        }),
      ).resolves.toBeDefined();
    });

    test.each([
      ["authCode", "a-different-code"],
      ["authState", "a-different-state"],
    ] as const)("should reject a mismatching %s", async (key, wrong) => {
      const { token } = await mint({
        ...baseContent,
        authCode: AUTH_CODE,
        authState: AUTH_STATE,
      });

      await expect(aegis.verify(token, { [key]: wrong })).rejects.toThrow();
    });
  });

  describe("tokenType matcher", () => {
    test("should accept the token's own type", async () => {
      const { token } = await mint(baseContent);

      await expect(
        aegis.verify(token, { tokenType: "test_token" }),
      ).resolves.toBeDefined();
    });

    test("should reject another type", async () => {
      const { token } = await mint(baseContent);

      await expect(aegis.verify(token, { tokenType: "access_token" })).rejects.toThrow();
    });

    // A COSE token carries its type in the COSE `typ` header (label 16, RFC
    // 9596) rather than a JOSE one, so the assertion is spelled `+cwt` — but it
    // is the SAME matcher, and a matcher silently dropped on one wire is the
    // dead-matcher class this surface exists to retire.
    test("should assert the type of a CWT too", async () => {
      const { token } = await aegis.mint(
        "access_token",
        {
          audience: ["https://rs.lindorm.io/"],
          clientId: "client-1",
          subject: "user-1",
        },
        { format: "cwt" },
      );

      await expect(
        aegis.verify(token, { tokenType: "access_token" }),
      ).resolves.toBeDefined();
      await expect(aegis.verify(token, { tokenType: "refresh_token" })).rejects.toThrow(
        /Invalid token/,
      );
    });
  });

  // `issuer` is an identity matcher like `scope`/`roles`, and the condition
  // language already evaluated an operator here — only the declared type refused
  // one, which forced consumers into a cast to express an OPTIONAL issuer bound.
  describe("issuer operator", () => {
    test("should accept an optional-bound issuer against a token that carries iss", async () => {
      const { token } = await mint(baseContent);

      await expect(
        aegis.verify(token, {
          issuer: { $or: [{ $exists: false }, { $eq: ISSUER }] },
        }),
      ).resolves.toBeDefined();
    });

    test("should reject an optional-bound issuer naming another issuer", async () => {
      const { token } = await mint(baseContent);

      await expect(
        aegis.verify(token, {
          issuer: { $or: [{ $exists: false }, { $eq: "https://other.test/" }] },
        }),
      ).rejects.toThrow();
    });

    test("should honour the same operator on the flat-dict surface", () => {
      const bound = { $or: [{ $exists: false }, { $eq: ISSUER }] };

      expect(Aegis.matches({ issuer: ISSUER }, { issuer: bound })).toBe(true);
      expect(Aegis.matches({ subject: "s" }, { issuer: bound })).toBe(true);
      expect(Aegis.matches({ issuer: "https://other.test/" }, { issuer: bound })).toBe(
        false,
      );
    });
  });
});
