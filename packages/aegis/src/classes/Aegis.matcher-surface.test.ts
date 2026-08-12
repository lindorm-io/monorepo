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

  // The PROFILED verify takes the same matcher argument (third positional), and
  // it has to mean the same thing on the COSE wire as on the JOSE one. It did
  // not: the profiled path short-circuited to the COSE reader without the
  // `assert` argument, so every matcher a caller passed was dropped and the
  // verify reported success on the profile floor alone.
  describe("profiled COSE verify — assert", () => {
    const RESOURCE = "https://rs.lindorm.io/";

    const mintCwt = () =>
      aegis.mint(
        "access_token",
        {
          audience: [RESOURCE],
          clientId: "client-1",
          scope: ["read", "write"],
          subject: "user-1",
        },
        { format: "cwt" },
      );

    test("should accept matchers the token satisfies", async () => {
      const { token } = await mintCwt();

      await expect(
        aegis.verify(
          "access_token",
          token,
          { audience: RESOURCE, scope: ["read"], subject: "user-1" },
          { audience: RESOURCE },
        ),
      ).resolves.toBeDefined();
    });

    test("should reject an audience matcher the token does not satisfy", async () => {
      const { token } = await mintCwt();

      // The floor's `audience` (the verifier's own identity) is satisfied — only
      // the caller's matcher is false, so a pass here would be the floor alone.
      await expect(
        aegis.verify(
          "access_token",
          token,
          { audience: "https://other.lindorm.io/" },
          { audience: RESOURCE },
        ),
      ).rejects.toMatchObject({ code: "claims_invalid" });
    });

    test("should reject a subject matcher the token does not satisfy", async () => {
      const { token } = await mintCwt();

      await expect(
        aegis.verify(
          "access_token",
          token,
          { subject: "another-user" },
          { audience: RESOURCE },
        ),
      ).rejects.toMatchObject({ code: "claims_invalid" });
    });

    // `tokenType` is asserted against the COSE typ header, and the profile floor
    // asserts its OWN typ against the same `coseTyp` mapping — so the two can
    // only ever agree or expose a matcher the caller asked for and that is false.
    test("should honour the tokenType matcher beside the profile's own typ", async () => {
      const { token } = await mintCwt();

      await expect(
        aegis.verify(
          "access_token",
          token,
          { tokenType: "access_token" },
          { audience: RESOURCE },
        ),
      ).resolves.toBeDefined();

      await expect(
        aegis.verify(
          "access_token",
          token,
          { tokenType: "refresh_token" },
          { audience: RESOURCE },
        ),
        // The caller's `tokenType` is a DOMAIN matcher, so its refusal is a
        // domain error under a wire-neutral code with the wire in `data`. It is
        // asserted once, above the wire seam, which is what makes it total: a
        // type whose short name is the bare conventional form (`id_token` → the
        // bare `JWT` / `application/cwt`) has no prefix for a kit to check.
      ).rejects.toMatchObject({
        code: "token_type_mismatch",
        data: { format: "cwt" },
      });
    });

    // ⚠ THE TOTALITY CASE, and the one a prefix-based check cannot cover.
    // `id_token`'s short name IS the bare conventional form — `JWT` on JOSE,
    // `application/cwt` on COSE — so it reduces to NO prefix, and a check gated
    // on a prefix being present simply does not run for it. Asserted on BOTH
    // wires because the assertion is the caller's, not the wire's, and a matcher
    // that holds on one encoding and not the other is a matcher an attacker
    // chooses to be bound by.
    test("should refuse a tokenType whose media type has no prefix, on both wires", async () => {
      const cwt = await mintCwt();

      await expect(
        aegis.verify(
          "access_token",
          cwt.token,
          { tokenType: "id_token" },
          {
            audience: RESOURCE,
          },
        ),
      ).rejects.toMatchObject({
        code: "token_type_mismatch",
        data: { format: "cwt" },
      });

      const jwt = await aegis.mint(
        "access_token",
        {
          audience: [RESOURCE],
          clientId: "client-1",
          scope: ["read", "write"],
          subject: "user-1",
        },
        { format: "jwt" },
      );

      await expect(
        aegis.verify(
          "access_token",
          jwt.token,
          { tokenType: "id_token" },
          {
            audience: RESOURCE,
          },
        ),
      ).rejects.toMatchObject({
        code: "token_type_mismatch",
        data: { format: "jwt" },
      });
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
