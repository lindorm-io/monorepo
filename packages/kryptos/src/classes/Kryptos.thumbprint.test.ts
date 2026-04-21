import { TEST_AKP_KEY_B64 } from "../__fixtures__/akp-keys";
import { TEST_EC_KEY_B64 } from "../__fixtures__/ec-keys";
import { TEST_OCT_KEY_B64 } from "../__fixtures__/oct-keys";
import { TEST_OKP_KEY_B64 } from "../__fixtures__/okp-keys";
import { TEST_RSA_KEY_B64 } from "../__fixtures__/rsa-keys";
import { KryptosError } from "../errors";
import { KryptosKit } from "./KryptosKit";
import { describe, expect, test } from "vitest";

describe("Kryptos.thumbprint", () => {
  test("should compute an RFC 7638 thumbprint for an EC key", () => {
    const kryptos = KryptosKit.from.b64(TEST_EC_KEY_B64);
    expect(kryptos.thumbprint).toMatchSnapshot();
  });

  test("should compute a thumbprint for an AKP key", () => {
    const kryptos = KryptosKit.from.b64(TEST_AKP_KEY_B64);
    expect(kryptos.thumbprint).toMatchSnapshot();
  });

  test("should compute an RFC 7638 thumbprint for an RSA key", () => {
    const kryptos = KryptosKit.from.b64(TEST_RSA_KEY_B64);
    expect(kryptos.thumbprint).toMatchSnapshot();
  });

  test("should compute an RFC 7638 thumbprint for an OKP key", () => {
    const kryptos = KryptosKit.from.b64(TEST_OKP_KEY_B64);
    expect(kryptos.thumbprint).toMatchSnapshot();
  });

  test("should compute an RFC 7638 thumbprint for an oct key", () => {
    const kryptos = KryptosKit.from.b64(TEST_OCT_KEY_B64);
    expect(kryptos.thumbprint).toMatchSnapshot();
  });

  test("should be stable across multiple reads", () => {
    const kryptos = KryptosKit.from.b64(TEST_EC_KEY_B64);
    expect(kryptos.thumbprint).toEqual(kryptos.thumbprint);
  });

  test("should throw when the key has been disposed", () => {
    const kryptos = KryptosKit.from.b64(TEST_EC_KEY_B64);
    kryptos.dispose();
    expect(() => kryptos.thumbprint).toThrow(KryptosError);
  });
});
