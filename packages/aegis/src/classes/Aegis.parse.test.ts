import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_ENC,
} from "../__fixtures__/keys.js";
import { AegisError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

// `aegis.parse` — the KEYLESS, UNVERIFIED CLAIMS read. It handles ONLY the three
// structured (claims-bearing) formats (jwt/cwt/cwm), yielding the domain header +
// claims buckets. Opaque signed formats (jws/cws) carry no claims, so parse throws
// `parse_requires_claims`; encrypted formats (jwe/cwe) are ciphertext, so parse
// throws `parse_requires_decrypt` (use `aegis.decrypt`).
describe("Aegis — parse (keyless, unverified)", () => {
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG); // ES512 signer (jwt/cwt/cws)
    amphora.add(TEST_OKP_KEY_ENC); // ECDH-ES recipient (jwe)
    amphora.add(TEST_OCT_KEY_ENC); // dir recipient (cwe)
  });

  const content = { expires: "1h", subject: "user-1", tokenType: "test_token" } as const;

  describe("structured — header + domain claims", () => {
    test("jwt", async () => {
      const { token } = await aegis.mint("default", content);

      const parsed = aegis.parse(token);

      expect(parsed.format).toBe("jwt");
      expect(parsed.header.baseFormat).toBe("JWT");
      expect(parsed.header.algorithm).toBe("ES512");
      expect(parsed.claims.subject).toBe("user-1");
      expect(parsed.claims.issuer).toBe(ISSUER);
    });

    test("cwt (COSE_Sign1)", async () => {
      const { token } = await aegis.mint("default", content, { format: "cwt" });
      expect(Aegis.isCwt(token)).toBe(true);

      const parsed = aegis.parse(token);

      expect(parsed.format).toBe("cwt");
      expect(parsed.header.algorithm).toBe("ES512");
      expect(parsed.claims.subject).toBe("user-1");
      expect(parsed.claims.issuer).toBe(ISSUER);
    });

    test("cwm (COSE_Mac0)", async () => {
      const logger = createMockLogger();
      const macAmphora = new Amphora({ domain: ISSUER, logger });
      const macAegis = new Aegis({ amphora: macAmphora, logger });
      await macAmphora.setup();
      macAmphora.add(TEST_OCT_KEY_SIG);

      const { token } = await macAegis.mint("default", content, { format: "cwm" });
      expect(Aegis.isCwm(token)).toBe(true);

      const parsed = macAegis.parse(token);

      expect(parsed.format).toBe("cwm");
      expect(parsed.claims.subject).toBe("user-1");
    });
  });

  describe("unstructured — REFUSED with parse_requires_claims", () => {
    test("jws", async () => {
      const { token } = await aegis.jws.sign("opaque-data");

      expect(() => aegis.parse(token)).toThrow(
        expect.objectContaining({ code: "parse_requires_claims" }),
      );
    });

    test("cws", async () => {
      const { token } = await aegis.cws.sign({ tid: "at_abc" }, { tokenType: "at" });

      expect(() => aegis.parse(token)).toThrow(
        expect.objectContaining({ code: "parse_requires_claims" }),
      );
    });
  });

  describe("encrypted — REFUSED with parse_requires_decrypt", () => {
    test("jwe", async () => {
      const { token } = await aegis.encrypt("secret", {
        key: { kryptos: TEST_OKP_KEY_ENC },
      });

      expect(() => aegis.parse(token)).toThrow(
        expect.objectContaining({ code: "parse_requires_decrypt" }),
      );
    });

    test("cwe (COSE_Encrypt0)", async () => {
      const { token } = await aegis.encrypt("secret", {
        format: "cwe",
        key: { kryptos: TEST_OCT_KEY_ENC },
      });
      expect(Aegis.isCwe(token)).toBe(true);

      expect(() => aegis.parse(token)).toThrow(
        expect.objectContaining({ code: "parse_requires_decrypt" }),
      );
    });
  });

  test("an unrecognised token throws unsupported_token_type", () => {
    expect(() => aegis.parse("not-a-token")).toThrow(
      expect.objectContaining({ code: "unsupported_token_type" }),
    );
  });

  test("parse is UNVERIFIED — a tampered signature still parses", async () => {
    const { token } = await aegis.mint("default", content);
    // Corrupt the signature segment: parse must NOT care (it never checks).
    const tampered = `${token.slice(0, -4)}AAAA`;

    const parsed = aegis.parse(tampered);
    expect(parsed.claims.subject).toBe("user-1");

    // ...whereas verify DOES check and rejects it.
    await expect(
      aegis.verify(tampered, undefined, { audience: ISSUER }),
    ).rejects.toBeInstanceOf(AegisError);
  });
});
