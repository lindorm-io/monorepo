import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

const MINTED_AT = new Date("2024-01-01T08:00:00.000Z");
// One hour after mint plus ten seconds: the token is expired by 10s, so a
// tolerance below that must reject it and one above it must accept it.
const EXPIRED_BY_TEN_SECONDS = new Date("2024-01-01T09:00:10.000Z");

const ISSUER = "https://test.lindorm.io/";
const AUDIENCE = "https://rs.lindorm.io/";

/**
 * `clockTolerance` is a PER-CALL verify knob, and the only thing that makes a
 * token inside the skew window verifiable without also weakening every other
 * verify. It was declared on the profiled surface and thrown away, so setting it
 * changed nothing; these tests pin that it changes the OUTCOME on both verify
 * surfaces and both wires.
 */
describe("verify clockTolerance", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    MockDate.set(MINTED_AT);

    const logger = createMockLogger();
    const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    aegis = new Aegis({ amphora, logger });

    await amphora.setup();

    amphora.add(TEST_EC_KEY_SIG);
  });

  afterEach(() => {
    MockDate.set(MINTED_AT);
  });

  const mintJwt = () =>
    aegis.mint("access_token", {
      audience: [AUDIENCE],
      clientId: "client-1",
      expires: "1h",
      subject: "user-1",
    });

  const mintCwt = () =>
    aegis.mint(
      "access_token",
      {
        audience: [AUDIENCE],
        clientId: "client-1",
        expires: "1h",
        subject: "user-1",
      },
      { format: "cwt" },
    );

  describe("profile-less verify", () => {
    test("should reject a token expired beyond the tolerance", async () => {
      const { token } = await mintJwt();

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(
        aegis.verify(token, undefined, { clockTolerance: 5 }),
      ).rejects.toThrow();
    });

    test("should accept a token expired within the tolerance", async () => {
      const { token } = await mintJwt();

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(
        aegis.verify(token, undefined, { clockTolerance: 60 }),
      ).resolves.toBeDefined();
    });

    test("should reject the same token with no tolerance", async () => {
      const { token } = await mintJwt();

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(aegis.verify(token)).rejects.toThrow();
    });
  });

  describe("profiled verify", () => {
    test("should accept a token expired within the tolerance", async () => {
      const { token } = await mintJwt();

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(
        aegis.verify("access_token", token, undefined, {
          audience: AUDIENCE,
          clockTolerance: 60,
        }),
      ).resolves.toBeDefined();
    });

    test("should reject a token expired beyond the tolerance", async () => {
      const { token } = await mintJwt();

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(
        aegis.verify("access_token", token, undefined, {
          audience: AUDIENCE,
          clockTolerance: 5,
        }),
      ).rejects.toThrow();
    });
  });

  describe("COSE verify", () => {
    test("should accept a CWT expired within the tolerance", async () => {
      const { token } = await mintCwt();

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(
        aegis.verify("access_token", token, undefined, {
          audience: AUDIENCE,
          clockTolerance: 60,
        }),
      ).resolves.toBeDefined();
    });

    test("should reject a CWT expired beyond the tolerance", async () => {
      const { token } = await mintCwt();

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(
        aegis.verify("access_token", token, undefined, {
          audience: AUDIENCE,
          clockTolerance: 5,
        }),
      ).rejects.toThrow();
    });

    test("should accept a profile-less CWT expired within the tolerance", async () => {
      const { token } = await mintCwt();

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(
        aegis.verify(token, undefined, { clockTolerance: 60 }),
      ).resolves.toBeDefined();
    });
  });

  // The deployment-wide default still applies when no per-call value is given —
  // the per-call knob overrides it rather than replacing the mechanism.
  describe("deployment default", () => {
    test("should apply the Aegis-level tolerance when the call sets none", async () => {
      const logger = createMockLogger();
      const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
      const tolerant = new Aegis({ amphora, clockTolerance: 60, logger });

      await amphora.setup();

      amphora.add(TEST_EC_KEY_SIG);

      const { token } = await tolerant.mint("access_token", {
        audience: [AUDIENCE],
        clientId: "client-1",
        expires: "1h",
        subject: "user-1",
      });

      MockDate.set(EXPIRED_BY_TEN_SECONDS);

      await expect(tolerant.verify(token)).resolves.toBeDefined();
    });
  });
});
