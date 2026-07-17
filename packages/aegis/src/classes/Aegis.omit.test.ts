import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import type { DecodedJwt } from "../types/index.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

// The empty-claim vocabulary the option governs: an empty array, an empty
// string, an empty object, and a real value that must always survive.
const CUSTOM = {
  empty_list: [] as string[],
  empty_text: "",
  empty_obj: {},
  kept: "yes",
};

describe("Aegis — omit (compact-by-default)", () => {
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({ domain: "https://test.lindorm.io/", logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG);
  });

  // The raw JOSE payload — bypasses the parse-side array defaulting so we see
  // exactly what reached the wire.
  const joseWire = (token: string): Record<string, unknown> =>
    (Aegis.decode(token) as DecodedJwt).payload as Record<string, unknown>;

  // The COSE claims, domain-keyed; custom claims pass through verbatim, so an
  // absent claim really is absent (no defaulting).
  const coseClaims = async (token: string): Promise<Record<string, unknown>> => {
    const verified = (await aegis.verify("access_token", token, {
      format: "cose",
      audience: "https://rs.lindorm.io/",
    })) as unknown as { claims: Record<string, unknown> };
    return verified.claims;
  };

  const CONTENT = {
    subject: "user-1",
    audience: ["https://rs.lindorm.io/"],
    clientId: "client-1",
    claims: CUSTOM,
  };

  describe("mint — default drops empty, threaded to both wires", () => {
    test("JWT (JOSE): empty array/string/object dropped, real claim kept", async () => {
      const { token } = await aegis.mint("access_token", CONTENT);
      const wire = joseWire(token);

      expect(wire).not.toHaveProperty("empty_list");
      expect(wire).not.toHaveProperty("empty_text");
      expect(wire).not.toHaveProperty("empty_obj");
      expect(wire.kept).toBe("yes");
    });

    test("CWT (COSE): empty array/string/object dropped, real claim kept", async () => {
      const { token } = await aegis.mint("access_token", CONTENT, { format: "cose" });
      const claims = await coseClaims(token);

      expect(claims).not.toHaveProperty("empty_list");
      expect(claims).not.toHaveProperty("empty_text");
      expect(claims).not.toHaveProperty("empty_obj");
      expect(claims.kept).toBe("yes");
    });

    test("JOSE and COSE agree on which claims are present", async () => {
      const jwt = await aegis.mint("access_token", CONTENT);
      const cwt = await aegis.mint("access_token", CONTENT, { format: "cose" });

      const wire = joseWire(jwt.token);
      const claims = await coseClaims(cwt.token);

      for (const key of ["empty_list", "empty_text", "empty_obj", "kept"]) {
        expect(key in wire).toBe(key in claims);
      }
    });
  });

  describe('mint — omit: "undefined" keeps empty claims on both wires', () => {
    test("JWT (JOSE): empty array/string/object preserved verbatim", async () => {
      const { token } = await aegis.mint("access_token", CONTENT, {
        omit: "undefined",
      });
      const wire = joseWire(token);

      expect(wire.empty_list).toEqual([]);
      expect(wire.empty_text).toBe("");
      expect(wire.empty_obj).toEqual({});
      expect(wire.kept).toBe("yes");
    });

    test("CWT (COSE): empty array/string/object preserved verbatim", async () => {
      const { token } = await aegis.mint("access_token", CONTENT, {
        format: "cose",
        omit: "undefined",
      });
      const claims = await coseClaims(token);

      expect(claims.empty_list).toEqual([]);
      expect(claims.empty_text).toBe("");
      expect(claims.empty_obj).toEqual({});
      expect(claims.kept).toBe("yes");
    });

    test("JOSE and COSE agree on which claims are present", async () => {
      const jwt = await aegis.mint("access_token", CONTENT, { omit: "undefined" });
      const cwt = await aegis.mint("access_token", CONTENT, {
        format: "cose",
        omit: "undefined",
      });

      const wire = joseWire(jwt.token);
      const claims = await coseClaims(cwt.token);

      for (const key of ["empty_list", "empty_text", "empty_obj", "kept"]) {
        expect(key in wire).toBe(key in claims);
      }
    });
  });

  describe("direct jwt.sign — reads its own options.omit", () => {
    const signContent = {
      subject: "user-1",
      expires: "1h" as const,
      tokenType: "Bearer" as const,
      claims: CUSTOM,
    };

    test("default drops empties", async () => {
      const { token } = await aegis.jwt.sign(signContent);
      const wire = joseWire(token);

      expect(wire).not.toHaveProperty("empty_list");
      expect(wire).not.toHaveProperty("empty_text");
      expect(wire.kept).toBe("yes");
    });

    test('omit: "undefined" keeps empties', async () => {
      const { token } = await aegis.jwt.sign(signContent, { omit: "undefined" });
      const wire = joseWire(token);

      expect(wire.empty_list).toEqual([]);
      expect(wire.empty_text).toBe("");
      expect(wire.kept).toBe("yes");
    });
  });

  describe("top-level aegis.sign — prunes a plain-object payload", () => {
    test("default drops empties", async () => {
      const { token } = await aegis.sign({ payload: { ...CUSTOM } });
      const [, payload] = token.split(".");
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

      expect(decoded).not.toHaveProperty("empty_list");
      expect(decoded).not.toHaveProperty("empty_text");
      expect(decoded.kept).toBe("yes");
    });

    test('omit: "undefined" keeps empties', async () => {
      const { token } = await aegis.sign({
        payload: { ...CUSTOM },
        omit: "undefined",
      });
      const [, payload] = token.split(".");
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

      expect(decoded.empty_list).toEqual([]);
      expect(decoded.empty_text).toBe("");
      expect(decoded.kept).toBe("yes");
    });
  });

  test("events is never pruned — its empty-object members are RFC 8417 meaningful", async () => {
    // A logout_token whose event payload is the standard empty `{}` must keep
    // `events` on BOTH wires, even under the default "empty" prune.
    const events = { "http://schemas.openid.net/event/backchannel-logout": {} };

    const jwt = await aegis.mint("logout_token", {
      audience: ["client-1"],
      subject: "user-1",
      events,
    });
    expect(joseWire(jwt.token).events).toEqual(events);

    const cwt = await aegis.mint(
      "logout_token",
      { audience: ["client-1"], subject: "user-1", events },
      { format: "cose" },
    );
    const verified = (await aegis.verify("logout_token", cwt.token, {
      format: "cose",
      audience: "client-1",
    })) as unknown as { claims: Record<string, unknown> };
    expect(verified.claims.events).toEqual(events);
  });
});
