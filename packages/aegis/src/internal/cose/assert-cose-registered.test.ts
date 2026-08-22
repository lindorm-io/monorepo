import type { KryptosAlgorithm } from "@lindorm/kryptos";
import { describe, expect, test } from "vitest";
import { CweError, CwsError } from "../../errors/index.js";
import { assertCoseRegistered } from "./assert-cose-registered.js";

/**
 * A PRIVATE-USE signing algorithm the interop gate must refuse. ⚠ Every algorithm
 * kryptos offers carries an official label, so no real key reaches the `alg`
 * branch — the cast stands in for a future one, and without it the branch goes
 * untested until that algorithm exists.
 */
const PRIVATE_USE_ALG = "XS256" as KryptosAlgorithm;

describe("assertCoseRegistered", () => {
  describe("alg", () => {
    test("accepts every officially registered signing algorithm", () => {
      for (const value of [
        "ES256",
        "ES512",
        "RS256",
        "PS512",
        "EdDSA",
        "HS256",
      ] as const) {
        expect(() =>
          assertCoseRegistered({
            kind: "alg",
            value,
            proprietary: undefined,
            error: CwsError,
          }),
        ).not.toThrow();
      }
    });

    test("ML-DSA is registered — RFC 9964 gave it official labels", () => {
      expect(() =>
        assertCoseRegistered({
          kind: "alg",
          value: "ML-DSA-65",
          proprietary: undefined,
          error: CwsError,
        }),
      ).not.toThrow();
    });

    test("REFUSES a private-use algorithm, which COSE never registered", () => {
      let thrown: { code?: string; message?: string; title?: string; data?: unknown } =
        {};

      try {
        assertCoseRegistered({
          kind: "alg",
          value: PRIVATE_USE_ALG,
          proprietary: undefined,
          error: CwsError,
        });
      } catch (error) {
        thrown = error as typeof thrown;
      }

      expect({
        code: thrown.code,
        message: thrown.message,
        title: thrown.title,
        data: thrown.data,
      }).toMatchSnapshot();
    });

    test("`proprietary: true` admits the private-use algorithm", () => {
      expect(() =>
        assertCoseRegistered({
          kind: "alg",
          value: PRIVATE_USE_ALG,
          proprietary: true,
          error: CwsError,
        }),
      ).not.toThrow();
    });

    test("an OMITTED proprietary flag is strict, not permissive", () => {
      for (const proprietary of [undefined, false]) {
        expect(() =>
          assertCoseRegistered({
            kind: "alg",
            value: PRIVATE_USE_ALG,
            proprietary,
            error: CwsError,
          }),
        ).toThrow(expect.objectContaining({ code: "cose_alg_not_registered" }));
      }
    });

    test("the refusal lands on the leaf error class the caller named", () => {
      expect(() =>
        assertCoseRegistered({
          kind: "alg",
          value: PRIVATE_USE_ALG,
          proprietary: false,
          error: CwsError,
        }),
      ).toThrow(CwsError);
    });
  });

  describe("enc", () => {
    test("accepts the officially registered AEADs", () => {
      for (const value of ["A128GCM", "A192GCM", "A256GCM"] as const) {
        expect(() =>
          assertCoseRegistered({
            kind: "enc",
            value,
            proprietary: undefined,
            error: CweError,
          }),
        ).not.toThrow();
      }
    });

    test("REFUSES the AES-CBC-HMAC family, which COSE never registered", () => {
      let thrown: { code?: string; message?: string; title?: string; data?: unknown } =
        {};

      try {
        assertCoseRegistered({
          kind: "enc",
          value: "A256CBC-HS512",
          proprietary: undefined,
          error: CweError,
        });
      } catch (error) {
        thrown = error as typeof thrown;
      }

      expect({
        code: thrown.code,
        message: thrown.message,
        title: thrown.title,
        data: thrown.data,
      }).toMatchSnapshot();
    });

    test("`proprietary: true` admits the private-use encryption", () => {
      // The same flag threads to the claim codec, so the two cannot disagree.
      expect(() =>
        assertCoseRegistered({
          kind: "enc",
          value: "A256CBC-HS512",
          proprietary: true,
          error: CweError,
        }),
      ).not.toThrow();
    });

    test("an OMITTED proprietary flag is strict, not permissive", () => {
      expect(() =>
        assertCoseRegistered({
          kind: "enc",
          value: "A128CBC-HS256",
          proprietary: undefined,
          error: CweError,
        }),
      ).toThrow(expect.objectContaining({ code: "cose_enc_not_registered" }));

      expect(() =>
        assertCoseRegistered({
          kind: "enc",
          value: "A128CBC-HS256",
          proprietary: false,
          error: CweError,
        }),
      ).toThrow(expect.objectContaining({ code: "cose_enc_not_registered" }));
    });
  });

  test("the refusal lands on the leaf error class the caller named", () => {
    expect(() =>
      assertCoseRegistered({
        kind: "enc",
        value: "A192CBC-HS384",
        proprietary: false,
        error: CweError,
      }),
    ).toThrow(CweError);
  });

  test("the two kinds carry DISTINCT codes and data keys", () => {
    // ⚠ The two codes report different `data` keys and a consumer routes on the
    // code, so they must not collapse. BOTH branches are driven here.
    let algThrown: { code?: string; data?: unknown } = {};
    let encThrown: { code?: string; data?: unknown } = {};

    try {
      assertCoseRegistered({
        kind: "alg",
        value: PRIVATE_USE_ALG,
        proprietary: false,
        error: CwsError,
      });
    } catch (error) {
      algThrown = error as typeof algThrown;
    }

    try {
      assertCoseRegistered({
        kind: "enc",
        value: "A256CBC-HS512",
        proprietary: false,
        error: CweError,
      });
    } catch (error) {
      encThrown = error as typeof encThrown;
    }

    expect(algThrown.code).toBe("cose_alg_not_registered");
    expect(algThrown.data).toEqual({ algorithm: "XS256" });

    expect(encThrown.code).toBe("cose_enc_not_registered");
    expect(encThrown.data).toEqual({ encryption: "A256CBC-HS512" });
  });
});
