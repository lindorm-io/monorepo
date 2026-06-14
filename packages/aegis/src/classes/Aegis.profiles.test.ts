import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import MockDate from "mockdate";
import {
  TEST_AKP_KEY_SIG,
  TEST_EC_KEY_SIG,
  TEST_OKP_KEY_SIG,
} from "../__fixtures__/keys.js";
import { JwtError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
import { JwtKit } from "./JwtKit.js";
import { beforeEach, describe, expect, test } from "vitest";
import { shaAlgorithm } from "../internal/utils/create-hash.js";
import { B64 } from "@lindorm/b64";
import { B64U } from "../internal/constants/format.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";
const RESOURCE = "https://rs.lindorm.io/";

describe("Aegis profiles", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  describe("access_token", () => {
    const content = {
      subject: "user-1",
      audience: [RESOURCE],
      clientId: "client-1",
      scope: ["openid", "profile"],
    };

    test("happy path produces a conformant at+jwt", async () => {
      const { token } = await aegis.mint("access_token", content);
      const { header, payload } = JwtKit.decode(token);

      expect(header.typ).toBe("at+jwt");
      expect(payload).toMatchObject({
        iss: ISSUER,
        sub: "user-1",
        aud: [RESOURCE],
        client_id: "client-1",
        scope: ["openid", "profile"],
        iat: 1704096000,
        exp: 1704099600,
      });
      expect(typeof payload.jti).toBe("string");
    });

    test("rejects a multi-resource aud", async () => {
      await expect(
        aegis.mint("access_token", {
          ...content,
          audience: [RESOURCE, "https://other"],
        }),
      ).rejects.toThrow(JwtError);
    });

    test("rejects a symmetric signing key", async () => {
      const { TEST_OCT_KEY_SIG } = await import("../__fixtures__/keys.js");
      const symAmphora = new Amphora({ domain: ISSUER, logger });
      await symAmphora.setup();
      symAmphora.add(TEST_OCT_KEY_SIG);
      const symAegis = new Aegis({ amphora: symAmphora, logger });

      await expect(symAegis.mint("access_token", content)).rejects.toThrow(JwtError);
    });
  });

  describe("id_token", () => {
    const content = {
      subject: "user-1",
      audience: ["client-1"],
    };

    test("happy path produces a bare JWT typ", async () => {
      const { token } = await aegis.mint("id_token", content);
      const { header, payload } = JwtKit.decode(token);

      expect(header.typ).toBe("JWT");
      expect(payload).toMatchObject({ iss: ISSUER, sub: "user-1", aud: ["client-1"] });
    });

    test("requires at_hash when an access token co-issues", async () => {
      await expect(
        aegis.mint("id_token", content, { context: { accessTokenIssued: true } }),
      ).rejects.toThrow(JwtError);
    });

    test("EdDSA id token produces a SHA-512 256-bit at_hash", async () => {
      const okpAmphora = new Amphora({ domain: ISSUER, logger });
      await okpAmphora.setup();
      okpAmphora.add(TEST_OKP_KEY_SIG);
      const okpAegis = new Aegis({ amphora: okpAmphora, logger });

      const { token } = await okpAegis.mint("id_token", {
        ...content,
        accessToken: "the-access-token",
      });
      const { payload } = JwtKit.decode(token);

      expect(shaAlgorithm("EdDSA")).toBe("SHA512");
      // SHA-512 left-most half = 256 bits = 32 bytes.
      expect(B64.toBuffer(payload.at_hash as string, B64U).length).toBe(32);
    });

    test("ML-DSA-65 id token produces a SHA-512 256-bit at_hash", async () => {
      const akpAmphora = new Amphora({ domain: ISSUER, logger });
      await akpAmphora.setup();
      akpAmphora.add(TEST_AKP_KEY_SIG);
      const akpAegis = new Aegis({ amphora: akpAmphora, logger });

      const { token } = await akpAegis.mint("id_token", {
        ...content,
        accessToken: "the-access-token",
      });
      const { payload } = JwtKit.decode(token);

      expect(shaAlgorithm("ML-DSA-65")).toBe("SHA512");
      expect(B64.toBuffer(payload.at_hash as string, B64U).length).toBe(32);
    });

    test("a *256 signing alg (ES256) produces a SHA-256 128-bit at_hash", async () => {
      // The house rule: a size-suffixed alg uses that SHA size; ES256 ⇒ SHA-256
      // ⇒ left-most half = 128 bits = 16 bytes (contrast EdDSA/ML-DSA ⇒ SHA-512
      // ⇒ 32 bytes above). No RS256 fixture exists, so ES256 stands in for the
      // *256 family.
      const es256Key = KryptosKit.generate.auto({ algorithm: "ES256" });
      const es256Amphora = new Amphora({ domain: ISSUER, logger });
      await es256Amphora.setup();
      es256Amphora.add(es256Key);
      const es256Aegis = new Aegis({ amphora: es256Amphora, logger });

      const { token } = await es256Aegis.mint("id_token", {
        ...content,
        accessToken: "the-access-token",
      });
      const { payload } = JwtKit.decode(token);

      expect(shaAlgorithm("ES256")).toBe("SHA256");
      expect(B64.toBuffer(payload.at_hash as string, B64U).length).toBe(16);
    });
  });

  describe("logout_token", () => {
    const content = {
      audience: ["client-1"],
      subject: "user-1",
      sessionId: "sess-1",
      events: { "http://schemas.openid.net/event/backchannel-logout": {} },
    };

    test("happy path produces a logout+jwt with events", async () => {
      const { token } = await aegis.mint("logout_token", content);
      const { header, payload } = JwtKit.decode(token);

      expect(header.typ).toBe("logout+jwt");
      expect(payload).toMatchObject({
        sub: "user-1",
        sid: "sess-1",
        events: { "http://schemas.openid.net/event/backchannel-logout": {} },
      });
    });

    test("rejects when neither sub nor sid is present", async () => {
      await expect(
        aegis.mint("logout_token", {
          audience: ["client-1"],
          events: content.events,
        } as never),
      ).rejects.toThrow(JwtError);
    });

    test("rejects a forbidden nonce", async () => {
      await expect(
        aegis.mint("logout_token", { ...content, nonce: "n" } as never),
      ).rejects.toThrow(JwtError);
    });
  });

  describe("security_event", () => {
    const content = {
      audience: ["https://receiver"],
      subjectId: { format: "iss_sub", iss: ISSUER, sub: "user-1" },
      events: { "urn:lindorm:event:test": {} },
    };

    test("happy path produces a secevent+jwt with no exp/sub", async () => {
      const { token } = await aegis.mint("security_event", content);
      const { header, payload } = JwtKit.decode(token);

      expect(header.typ).toBe("secevent+jwt");
      expect(payload.exp).toBeUndefined();
      expect(payload.sub).toBeUndefined();
      expect(payload.sub_id).toMatchObject({ format: "iss_sub" });
      expect(payload.events).toMatchObject({ "urn:lindorm:event:test": {} });
    });

    test("rejects a forbidden sub", async () => {
      await expect(
        aegis.mint("security_event", { ...content, subject: "user-1" } as never),
      ).rejects.toThrow(JwtError);
    });

    test("rejects a missing sub_id", async () => {
      await expect(
        aegis.mint("security_event", {
          audience: ["https://receiver"],
          events: content.events,
        } as never),
      ).rejects.toThrow(JwtError);
    });
  });

  describe("erasure_token", () => {
    test("happy path produces an erasure+jwt", async () => {
      const { token } = await aegis.mint("erasure_token", {
        audience: ["client-1"],
        subject: "user-1",
        events: { "urn:lindorm:event:rtbf": { rtbf_request_id: "r-1" } },
      });
      const { header, payload } = JwtKit.decode(token);

      expect(header.typ).toBe("erasure+jwt");
      expect(payload).toMatchObject({ sub: "user-1" });
      expect(payload.events).toMatchObject({ "urn:lindorm:event:rtbf": {} });
    });
  });

  describe("introspection / userinfo / jarm", () => {
    test("introspection carries the token_introspection object", async () => {
      const { token } = await aegis.mint("introspection", {
        audience: ["https://rs"],
        claims: { token_introspection: { active: true } },
      });
      const { header, payload } = JwtKit.decode(token);

      expect(header.typ).toBe("token-introspection+jwt");
      expect(payload.token_introspection).toMatchObject({ active: true });
    });

    test("userinfo signs with no mandated typ", async () => {
      const { token } = await aegis.mint("userinfo", {
        subject: "user-1",
        audience: ["client-1"],
      });
      const { payload } = JwtKit.decode(token);

      expect(payload).toMatchObject({ sub: "user-1", aud: ["client-1"] });
    });

    test("jarm carries response parameters", async () => {
      const { token } = await aegis.mint("jarm", {
        audience: ["client-1"],
        claims: { code: "abc", state: "xyz" },
      });
      const { payload } = JwtKit.decode(token);

      expect(payload).toMatchObject({ code: "abc", state: "xyz", aud: ["client-1"] });
    });
  });

  describe("delegation / client_assertion (per-token issuer)", () => {
    test("delegation uses the per-token issuer, not the platform issuer", async () => {
      const { token } = await aegis.mint("delegation", {
        issuer: "client-1",
        subject: "customer-sub",
        audience: [ISSUER],
      });
      const { header, payload } = JwtKit.decode(token);

      expect(header.typ).toBe("delegation+jwt");
      expect(payload.iss).toBe("client-1");
      expect(payload.sub).toBe("customer-sub");
    });

    test("client_assertion uses iss=sub=client_id, bare JWT typ", async () => {
      const { token } = await aegis.mint("client_assertion", {
        issuer: "client-1",
        subject: "client-1",
        audience: [ISSUER],
      });
      const { header, payload } = JwtKit.decode(token);

      expect(header.typ).toBe("JWT");
      expect(payload.iss).toBe("client-1");
    });
  });
});
