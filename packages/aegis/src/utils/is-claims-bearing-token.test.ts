import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { foreignEncrypt0 } from "../__fixtures__/foreign-encrypt0.js";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
import { Aegis } from "../classes/Aegis.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
import { encToCoseLabel } from "../internal/cose/enc-labels.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { isClaimsBearingToken } from "./is-claims-bearing-token.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * A COSE_Encrypt0 a foreign producer sealed, stating `cty` as given. The
 * predicate is keyless, so the plaintext is never read.
 */
const foreignCwe = (cty: unknown): string =>
  foreignEncrypt0(
    TEST_OCT_KEY_ENC,
    new Map<CoseLabel, unknown>([
      [coseByJose("alg"), encToCoseLabel("A256GCM")],
      [coseByJose("cty"), cty],
    ]),
    Buffer.from("sealed", "utf8"),
  ).toString("base64url");

/**
 * The predicate that decides VERIFY-LOCALLY vs INTROSPECT, proved against REAL
 * tokens of all seven wire formats — the only way to show that the split falls
 * on the CLAIMS LAYER and not on the wire family. Every token here is one aegis
 * itself minted, so a false positive is a token a consumer would treat as
 * authenticated with nothing in it.
 */
describe("isClaimsBearingToken", () => {
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, issuer: ISSUER, logger });
    await amphora.setup();
    // One asymmetric signer in the vault — a CWT is a COSE_Sign1 and refuses a
    // symmetric key. The CWM test injects its own MAC key.
    amphora.add(TEST_EC_KEY_SIG);
    amphora.add(TEST_EC_KEY_ENC);
    amphora.add(TEST_OCT_KEY_ENC);
  });

  describe("structured — the claims-bearing formats", () => {
    test("true for a JWT", async () => {
      const { token } = await aegis.jwt.sign({ sub: "user-1", exp: 1704099600 });

      expect(isClaimsBearingToken(token)).toBe(true);
    });

    test("true for a CWT (COSE_Sign1)", async () => {
      const { token } = await aegis.cwt.sign(
        { sub: "user-1", exp: 1704099600 },
        { tokenType: "at" },
      );

      expect(isClaimsBearingToken(token)).toBe(true);
    });

    test("true for a CWM (COSE_Mac0) — the symmetric CWT twin", async () => {
      const { token } = await aegis.cwm.sign(
        { sub: "user-1", exp: 1704099600 },
        { tokenType: "at", key: { kryptos: TEST_OCT_KEY_SIG } },
      );

      expect(isClaimsBearingToken(token)).toBe(true);
    });
  });

  describe("unstructured — an opaque handle is NEVER claims-bearing", () => {
    test("false for a JWS, whatever it is signed with", async () => {
      const { token } = await aegis.jws.sign(Buffer.from("opaque-handle"));

      // The security case: a real signature over a real payload, and still not
      // a credential anyone but the issuer can say anything about.
      expect(isClaimsBearingToken(token)).toBe(false);
    });

    test("false for a CWS — the COSE twin of the opaque handle", async () => {
      const { token } = await aegis.cws.sign(Buffer.from("opaque-handle"));

      expect(isClaimsBearingToken(token)).toBe(false);
    });
  });

  describe("encrypted — decided by the DECLARED content type", () => {
    test("true for a sign-then-encrypt JWE (cty: JWT)", async () => {
      const inner = (await aegis.jwt.sign({ sub: "user-1", exp: 1704099600 })).token;
      const { token } = await aegis.jwe.encrypt(inner, {
        header: { cty: "JWT" },
        key: { kryptos: TEST_EC_KEY_ENC },
      });

      expect(isClaimsBearingToken(token)).toBe(true);
    });

    test("true for a sign-then-encrypt JWE minted by the profile pipeline", async () => {
      const { token } = await aegis.mint(
        "id_token",
        { subject: "user-1", audience: ["client-1"] },
        {
          context: { accessTokenIssued: false },
          encrypt: { key: { kryptos: TEST_EC_KEY_ENC } },
        },
      );

      expect(isClaimsBearingToken(token)).toBe(true);
    });

    test("true for a sign-then-encrypt CWE (cty: application/cwt)", async () => {
      const { token } = await aegis.mint(
        "id_token",
        { subject: "user-1", audience: ["client-1"] },
        {
          context: { accessTokenIssued: false },
          format: "cwt",
          encrypt: { key: { kryptos: TEST_OCT_KEY_ENC } },
        },
      );

      expect(isClaimsBearingToken(token)).toBe(true);
    });

    test("true for a CWE whose cty is the CoAP Content-Format 61 (application/cwt)", () => {
      expect(isClaimsBearingToken(foreignCwe(61))).toBe(true);
    });

    test("false for a CWE whose cty is the CoAP Content-Format 0 (text/plain)", () => {
      expect(isClaimsBearingToken(foreignCwe(0))).toBe(false);
    });

    test.each<[shape: string, cty: unknown]>([
      ["a registered ID that carries a content coding", 11050],
      ["an unregistered integer", 1],
      ["a negative integer", -1],
      ["a byte string", Buffer.from("application/cwt", "utf8")],
      ["an array", ["application/cwt"]],
      ["a map", new Map([[1, "application/cwt"]])],
      ["null", null],
      ["false", false],
      ["a uint beyond the safe integers", 18446744073709551615n],
    ])("false, and no throw, for a CWE whose cty is %s", (_shape, cty) => {
      expect(isClaimsBearingToken(foreignCwe(cty))).toBe(false);
    });

    test("true when the declared cty carries RFC 2045 parameters", async () => {
      const inner = (await aegis.jwt.sign({ sub: "user-1", exp: 1704099600 })).token;
      const { token } = await aegis.jwe.encrypt(inner, {
        header: { cty: "application/at+jwt; charset=utf-8" },
        key: { kryptos: TEST_EC_KEY_ENC },
      });

      expect(isClaimsBearingToken(token)).toBe(true);
    });

    test("false for a JWE over plain content — no claims declared", async () => {
      const { token } = await aegis.jwe.encrypt(
        { sub: "user-1" },
        { key: { kryptos: TEST_EC_KEY_ENC } },
      );

      // `aegis.verify` refuses this outright (`verify_requires_signature`): an
      // unsigned claims set is confidential, not sender-authenticated. Admitting
      // it would route a credential to a verify that can only throw.
      expect(isClaimsBearingToken(token)).toBe(false);
    });

    test("false for a CWE over plain content", async () => {
      const { token } = await aegis.cwe.encrypt("hello cose", {
        key: { kryptos: TEST_OCT_KEY_ENC },
      });

      expect(isClaimsBearingToken(token)).toBe(false);
    });

    test("false for a JWE that declares an OPAQUE nested token", async () => {
      const inner = (await aegis.jws.sign(Buffer.from("opaque-handle"))).token;
      const { token } = await aegis.jwe.encrypt(inner, {
        header: { cty: "application/jose" },
        key: { kryptos: TEST_EC_KEY_ENC },
      });

      expect(isClaimsBearingToken(token)).toBe(false);
    });
  });

  describe("non-tokens", () => {
    test("false for junk", () => {
      expect(isClaimsBearingToken("opaque-access-token")).toBe(false);
      expect(isClaimsBearingToken("not a token")).toBe(false);
      expect(isClaimsBearingToken("a.b.c")).toBe(false);
      expect(isClaimsBearingToken("")).toBe(false);
    });
  });
});
