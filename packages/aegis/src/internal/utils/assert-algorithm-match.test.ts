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
    let thrown: { code?: string; data?: unknown; debug?: unknown } = {};

    try {
      assertAlgorithmMatch({
        actual: undefined,
        expected: "ES512",
        format: "cws",
        error: CwsError,
        details:
          "The protected header alg does not match the algorithm of the configured kryptos key.",
      });
    } catch (caught) {
      thrown = caught as typeof thrown;
    }

    expect({ code: thrown.code, data: thrown.data, debug: thrown.debug }).toStrictEqual({
      code: "cws_algorithm_mismatch",
      data: {},
      debug: { actual: undefined, expected: "ES512" },
    });
  });

  describe("each wire refuses under its OWN code, title and words", () => {
    test.each([
      ["jwt", JwtError, JOSE_DETAILS],
      ["jws", JwsError, JOSE_DETAILS],
      [
        "jwe",
        JweError,
        "The header alg does not match the key-management algorithm of the configured kryptos key.",
      ],
      [
        "cws",
        CwsError,
        "The protected header alg does not match the algorithm of the configured kryptos key.",
      ],
      [
        "cwt",
        CwtError,
        "The protected header alg does not match the algorithm of the configured kryptos key.",
      ],
      [
        "cwm",
        CwmError,
        "The protected header alg does not match the algorithm of the configured kryptos key.",
      ],
    ] as const)("%s", (format, error, details) => {
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

  test("neither algorithm rides `data`; the header's and the configured key's ride `debug`", () => {
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
        data: {},
        debug: { actual: "RS256", expected: "ES512" },
      }),
    );
  });
});
