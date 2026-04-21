import { getEcDecryptionKey as _getEcDecryptionKey } from "../key-types/get-ec-keys.js";
import { getOctDecryptionKey as _getOctDecryptionKey } from "../key-types/get-oct-keys.js";
import { getOkpDecryptionKey as _getOkpDecryptionKey } from "../key-types/get-okp-keys.js";
import { getRsaDecryptionKey as _getRsaDecryptionKey } from "../key-types/get-rsa-keys.js";
import {
  TEST_EC_KEY,
  TEST_OCT_KEY,
  TEST_OKP_KEY,
  TEST_RSA_KEY,
} from "../../../__fixtures__/keys.js";
import { getDecryptionKey } from "./get-decryption-key.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../key-types/get-ec-keys.js");
vi.mock("../key-types/get-oct-keys.js");
vi.mock("../key-types/get-okp-keys.js");
vi.mock("../key-types/get-rsa-keys.js");

const getEcDecryptionKey = _getEcDecryptionKey as Mock;
const getOctDecryptionKey = _getOctDecryptionKey as Mock;
const getOkpDecryptionKey = _getOkpDecryptionKey as Mock;
const getRsaDecryptionKey = _getRsaDecryptionKey as Mock;

describe("getDecryptionKey", () => {
  beforeEach(() => {
    getEcDecryptionKey.mockReturnValue("getEcDecryptionKey");
    getOctDecryptionKey.mockReturnValue("getOctDecryptionKey");
    getOkpDecryptionKey.mockReturnValue("getOkpDecryptionKey");
    getRsaDecryptionKey.mockReturnValue("getRsaDecryptionKey");
  });

  afterEach(vi.clearAllMocks);

  test("should resolve decryption key with EC key", () => {
    expect(
      getDecryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_EC_KEY,
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
      }),
    ).toEqual("getEcDecryptionKey");
  });

  test("should resolve decryption key with OCT key", () => {
    expect(
      getDecryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_OCT_KEY,
      }),
    ).toEqual("getOctDecryptionKey");
  });

  test("should resolve decryption key with OKP key", () => {
    expect(
      getDecryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_OKP_KEY,
        publicEncryptionJwk: { crv: "P-521", x: "x", y: "y", kty: "EC" },
      }),
    ).toEqual("getOkpDecryptionKey");
  });

  test("should resolve decryption key with RSA key", () => {
    expect(
      getDecryptionKey({
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("public-encryption-key"),
        kryptos: TEST_RSA_KEY,
      }),
    ).toEqual("getRsaDecryptionKey");
  });
});
