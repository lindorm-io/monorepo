import { Amphora } from "@lindorm/amphora";
import type { IKryptos } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
import { Aegis } from "../classes/Aegis.js";
import type { StructuredFormat, VerifiedToken } from "../types/index.js";
import { isStructuredToken } from "./is-structured-token.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

// Every input below is a REAL mint→verify round trip rather than a hand-written
// literal: the guard's whole purpose is to match what `verify` actually returns,
// and a literal would only ever prove that the guard agrees with the test author.
const createAegis = async (...keys: Array<IKryptos>): Promise<Aegis> => {
  const logger = createMockLogger();
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
  const aegis = new Aegis({ amphora, logger });

  await amphora.setup();
  for (const key of keys) amphora.add(key);

  return aegis;
};

const ID_TOKEN = { subject: "user-1", audience: ["client-1"] };
const ACCESS_TOKEN = {
  subject: "user-1",
  audience: ["https://rs.lindorm.io/"],
  clientId: "client-1",
};

describe("isStructuredToken", () => {
  describe("claims-bearing formats", () => {
    test("should accept a jwt", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG);
      const { token } = await aegis.mint("access_token", ACCESS_TOKEN);
      const verified = await aegis.verify(token);

      expect(verified.format).toBe("jwt");
      expect(isStructuredToken(verified)).toBe(true);
    });

    test("should accept a cwt (COSE_Sign1)", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG);
      const { token } = await aegis.mint("access_token", ACCESS_TOKEN, {
        format: "cwt",
      });
      const verified = await aegis.verify(token);

      expect(verified.format).toBe("cwt");
      expect(isStructuredToken(verified)).toBe(true);
    });

    test("should accept a cwm (COSE_Mac0)", async () => {
      const aegis = await createAegis(TEST_OCT_KEY_SIG);
      const { token } = await aegis.mint("id_token", ID_TOKEN, {
        context: { accessTokenIssued: false },
        format: "cwm",
      });
      const verified = await aegis.verify(token);

      expect(verified.format).toBe("cwm");
      expect(isStructuredToken(verified)).toBe(true);
    });
  });

  describe("opaque formats", () => {
    test("should reject a jws", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG);
      const { token } = await aegis.jws.sign(Buffer.from("opaque-handle"));
      const verified = await aegis.verify(token);

      expect(verified.format).toBe("jws");
      expect(verified.claims).toEqual({});
      expect(isStructuredToken(verified)).toBe(false);
    });

    test("should reject a cws", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG);
      const { token } = await aegis.sign({
        payload: { tid: "at_abc", sec: "s3cr3t" },
        tokenType: "access_token",
        format: "cws",
      });
      const verified = await aegis.verify(token);

      expect(verified.format).toBe("cws");
      expect(verified.claims).toEqual({});
      expect(isStructuredToken(verified)).toBe(false);
    });
  });

  describe("encrypting outers", () => {
    // The case a `format === "jwt"` check drops in production: an encrypted
    // id_token (OIDC `id_token_encrypted_response_alg`). `claims` is fully
    // populated — only the outer tag reads `jwe`.
    test("should accept a jwe wrapping a jwt", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG, TEST_EC_KEY_ENC);
      const { token } = await aegis.mint("id_token", ID_TOKEN, {
        context: { accessTokenIssued: false },
        encrypt: {},
      });
      const verified = await aegis.verify(token);

      expect(verified.format).toBe("jwe");
      expect(verified.inner).toBe("jwt");
      expect(verified.claims.subject).toBe("user-1");
      expect(isStructuredToken(verified)).toBe(true);
    });

    test("should accept a cwe wrapping a cwt", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC);
      const { token } = await aegis.mint("id_token", ID_TOKEN, {
        context: { accessTokenIssued: false },
        format: "cwt",
        encrypt: {},
      });
      const verified = await aegis.verify(token);

      expect(verified.format).toBe("cwe");
      expect(verified.inner).toBe("cwt");
      expect(verified.claims.subject).toBe("user-1");
      expect(isStructuredToken(verified)).toBe(true);
    });

    // The outer says the same word; the inner is what decides. An honestly
    // declared opaque plaintext (`cty: text/plain`) stays opaque after the peel.
    test("should reject a jwe wrapping a jws", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG, TEST_EC_KEY_ENC);
      const jws = (await aegis.jws.sign(Buffer.from("opaque-handle"))).token;
      const { token } = await aegis.jwe.encrypt(jws, {
        header: { cty: "text/plain" },
      });
      const verified = await aegis.verify(token);

      expect(verified.format).toBe("jwe");
      expect(verified.inner).toBe("jws");
      expect(verified.claims).toEqual({});
      expect(isStructuredToken(verified)).toBe(false);
    });
  });

  // The one input built by hand rather than round-tripped, because `verify`
  // cannot produce it: `inner` is only ever set under a jwe/cwe. It is worth
  // testing anyway — the guard is public, and a consumer's MOCK is exactly the
  // place a stray `inner` shows up. The guard must read the outer, not trust a
  // field that format never sets.
  test("should reject an opaque format carrying a stray inner", () => {
    const token = {
      format: "jws",
      inner: "jwt",
      header: {},
      claims: {},
      custom: {},
      token: "not-a-real-token",
    } as unknown as VerifiedToken;

    expect(isStructuredToken(token)).toBe(false);
  });

  describe("nullish", () => {
    // Deliberate: the check this replaces is `if (!token || token.format !== "jwt")`,
    // so the guard has to swallow both halves or it has not replaced anything.
    test("should reject null", () => {
      expect(isStructuredToken(null)).toBe(false);
    });

    test("should reject undefined", () => {
      expect(isStructuredToken(undefined)).toBe(false);
    });
  });

  /**
   * ⚠ THE TABLES ARE READ AS KEYS, NOT AS PROPERTIES. Both lookups sit on plain
   * object literals (`STRUCTURED`, `ENCRYPTING`) and both keys come off a token
   * the CALLER handed in, so `format in STRUCTURED` resolved through
   * `Object.prototype` and narrowed `{ format: "constructor" }` to a
   * claims-bearing token — one this guard's eleven pylon call sites would then
   * read `claims` off. `in` on a caller-influenced key is a BANNED construct in
   * this package.
   *
   * A hand-written literal is the right input HERE, unlike every row above:
   * `verify` cannot produce one of these, which is exactly why the guard has to
   * survive it. `as never` states that the shape is off-contract on purpose.
   */
  describe("a prototype member is not a format", () => {
    test.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
      "should reject the outer format %s",
      (format) => {
        expect(isStructuredToken({ format } as never)).toBe(false);
      },
    );

    test.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
      "should reject the inner format %s under a real encrypting outer",
      (inner) => {
        expect(isStructuredToken({ format: "jwe", inner } as never)).toBe(false);
      },
    );

    // …while the real pair it stands next to still narrows, so the guard is not
    // simply refusing everything hand-built.
    test("should still accept a structured inner under an encrypting outer", () => {
      expect(isStructuredToken({ format: "jwe", inner: "jwt" } as never)).toBe(true);
    });
  });

  describe("narrowing", () => {
    // The runtime answer is only half the point — the guard has to NARROW, or a
    // consumer still needs its own cast. These assignments are the assertion:
    // they do not compile if the predicate stops narrowing.
    test("should narrow a bare structured token's format", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG);
      const { token } = await aegis.mint("access_token", ACCESS_TOKEN);
      const verified: VerifiedToken = await aegis.verify(token);

      if (!isStructuredToken(verified)) throw new Error("expected structured");

      const format: StructuredFormat | "jwe" | "cwe" = verified.format;
      expect(format).toBe("jwt");
    });

    test("should narrow an encrypting outer's inner to a required field", async () => {
      const aegis = await createAegis(TEST_EC_KEY_SIG, TEST_EC_KEY_ENC);
      const { token } = await aegis.mint("id_token", ID_TOKEN, {
        context: { accessTokenIssued: false },
        encrypt: {},
      });
      const verified: VerifiedToken = await aegis.verify(token);

      if (!isStructuredToken(verified)) throw new Error("expected structured");
      if (verified.format !== "jwe" && verified.format !== "cwe") {
        throw new Error("expected an encrypting outer");
      }

      // `inner` is optional on VerifiedToken and REQUIRED on the narrowed arm.
      const inner: StructuredFormat = verified.inner;
      expect(inner).toBe("jwt");
    });
  });

  // One table over the whole seven-member union, so the surface is reviewable in
  // a single diff rather than spread across the cases above.
  test("should match the recorded format matrix", async () => {
    const sig = await createAegis(TEST_EC_KEY_SIG);
    const mac = await createAegis(TEST_OCT_KEY_SIG);
    const jose = await createAegis(TEST_EC_KEY_SIG, TEST_EC_KEY_ENC);
    const cose = await createAegis(TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC);

    const verified = await Promise.all([
      sig.mint("access_token", ACCESS_TOKEN).then((r) => sig.verify(r.token)),
      sig
        .mint("access_token", ACCESS_TOKEN, { format: "cwt" })
        .then((r) => sig.verify(r.token)),
      mac
        .mint("id_token", ID_TOKEN, {
          context: { accessTokenIssued: false },
          format: "cwm",
        })
        .then((r) => mac.verify(r.token)),
      sig.jws.sign(Buffer.from("opaque")).then((r) => sig.verify(r.token)),
      sig
        .sign({ payload: { sec: "s" }, tokenType: "access_token", format: "cws" })
        .then((r) => sig.verify(r.token)),
      jose
        .mint("id_token", ID_TOKEN, {
          context: { accessTokenIssued: false },
          encrypt: {},
        })
        .then((r) => jose.verify(r.token)),
      cose
        .mint("id_token", ID_TOKEN, {
          context: { accessTokenIssued: false },
          format: "cwt",
          encrypt: {},
        })
        .then((r) => cose.verify(r.token)),
      jose.jws
        .sign(Buffer.from("opaque"))
        .then((r) => jose.jwe.encrypt(r.token, { header: { cty: "text/plain" } }))
        .then((r) => jose.verify(r.token)),
    ]);

    expect(
      verified.map((token) => ({
        format: token.format,
        inner: token.inner,
        structured: isStructuredToken(token),
      })),
    ).toMatchSnapshot();
  });
});
