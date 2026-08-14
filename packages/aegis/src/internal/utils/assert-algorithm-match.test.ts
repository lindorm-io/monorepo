import { describe, expect, test } from "vitest";
import {
  CwmError,
  CwsError,
  CwtError,
  JweError,
  JwsError,
  JwtError,
} from "../../errors/index.js";
import { assertAlgorithmMatch } from "./assert-algorithm-match.js";

const JOSE_DETAILS =
  "The header alg does not match the signing algorithm of the configured kryptos key.";

describe("assertAlgorithmMatch", () => {
  test("passes when the header names the configured key's algorithm", () => {
    expect(() =>
      assertAlgorithmMatch({
        actual: "ES512",
        expected: "ES512",
        format: "jwt",
        error: JwtError,
        details: JOSE_DETAILS,
      }),
    ).not.toThrow();
  });

  test("refuses a header naming NO algorithm at all", () => {
    // An absent alg is a mismatch, not a pass: the gate exists so a signature
    // cycle is never spent on a structure whose declared algorithm is unknown.
    expect(() =>
      assertAlgorithmMatch({
        actual: undefined,
        expected: "ES512",
        format: "cws",
        error: CwsError,
        details:
          "The protected header alg does not match the algorithm of the configured kryptos key.",
      }),
    ).toThrow(
      expect.objectContaining({
        code: "cws_algorithm_mismatch",
        data: { algorithm: undefined },
      }),
    );
  });

  describe("each wire refuses under its OWN code, title and words", () => {
    test.each([
      ["jwt", JwtError, JOSE_DETAILS, undefined],
      ["jws", JwsError, JOSE_DETAILS, undefined],
      [
        "jwe",
        JweError,
        "The header alg does not match the key-management algorithm of the configured kryptos key.",
        // ⚠ The JWE wire has always reported the value under `alg`, not `algorithm`.
        { alg: "RSA-OAEP" },
      ],
      [
        "cws",
        CwsError,
        "The protected header alg does not match the algorithm of the configured kryptos key.",
        undefined,
      ],
      [
        "cwt",
        CwtError,
        "The protected header alg does not match the algorithm of the configured kryptos key.",
        undefined,
      ],
      [
        "cwm",
        CwmError,
        "The protected header alg does not match the algorithm of the configured kryptos key.",
        undefined,
      ],
    ] as const)("%s", (format, error, details, data) => {
      let thrown: {
        code?: string;
        title?: string;
        details?: string;
        data?: unknown;
        debug?: unknown;
      } = {};

      try {
        assertAlgorithmMatch({
          actual: "RSA-OAEP",
          expected: "ES512",
          format,
          error,
          details,
          data,
        });
      } catch (caught) {
        thrown = caught as typeof thrown;
      }

      expect({
        code: thrown.code,
        title: thrown.title,
        details: thrown.details,
        data: thrown.data,
        debug: thrown.debug,
      }).toMatchSnapshot();
    });
  });

  test("the refusal lands on the leaf error class the caller named", () => {
    expect(() =>
      assertAlgorithmMatch({
        actual: "RS256",
        expected: "ES512",
        format: "jws",
        error: JwsError,
        details: JOSE_DETAILS,
      }),
    ).toThrow(JwsError);
  });

  test("the expected algorithm rides `debug`, never `data`", () => {
    // `data` is caller-facing and reports what the TOKEN said; what THIS
    // deployment holds is operator detail and stays in debug.
    expect(() =>
      assertAlgorithmMatch({
        actual: "RS256",
        expected: "ES512",
        format: "jwt",
        error: JwtError,
        details: JOSE_DETAILS,
      }),
    ).toThrow(
      expect.objectContaining({
        data: { algorithm: "RS256" },
        debug: { expected: "ES512" },
      }),
    );
  });
});
