import MockDate from "mockdate";
import {
  TEST_X509_ALT_INTERMEDIATE_PEM,
  TEST_X509_ALT_ROOT_PEM,
  TEST_X509_BAD_INTERMEDIATE_PEM,
  TEST_X509_EXPIRED_PEM,
  TEST_X509_INTERMEDIATE_PEM,
  TEST_X509_LEAF_PEM,
  TEST_X509_ROOT_PEM,
} from "../../../__fixtures__/x509";
import { parseX509 } from "./parse-x509";
import { verifyX509Chain } from "./verify-chain";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

describe("verifyX509Chain", () => {
  beforeAll(() => {
    // Pin clock to a date inside the fixture chain validity window
    // (fixture certs: 2026-04-13 to 2126-03-20).
    MockDate.set(new Date("2030-06-15T12:00:00.000Z").toISOString());
  });

  afterAll(() => {
    MockDate.reset();
  });

  test("accepts a valid leaf -> intermediate -> root chain anchored at root", () => {
    const chain = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).not.toThrow();
  });

  test("accepts a chain that ends one level below the trust anchor", () => {
    const chain = parseX509([TEST_X509_LEAF_PEM, TEST_X509_INTERMEDIATE_PEM]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).not.toThrow();
  });

  test("throws when the signature link in the chain is broken", () => {
    const chain = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_ALT_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).toThrow(
      /Signature verification failed/,
    );
  });

  test("throws when an expired certificate is in the chain", () => {
    const chain = parseX509([TEST_X509_EXPIRED_PEM, TEST_X509_ROOT_PEM]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).toThrow(
      /outside its validity window/,
    );
  });

  test("throws when a non-leaf certificate is not marked as a CA", () => {
    const chain = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_BAD_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(() => verifyX509Chain(chain, TEST_X509_ROOT_PEM)).toThrow(
      /not marked as a CA/,
    );
  });

  test("throws when the chain does not match any trust anchor", () => {
    const chain = parseX509([
      TEST_X509_LEAF_PEM,
      TEST_X509_INTERMEDIATE_PEM,
      TEST_X509_ROOT_PEM,
    ]);

    expect(() => verifyX509Chain(chain, TEST_X509_ALT_ROOT_PEM)).toThrow(
      /does not match any trust anchor/,
    );
  });
});
