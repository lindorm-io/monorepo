import { getEcEncryptionKey as _getEcEncryptionKey } from "../key-types/get-ec-keys.js";
import { getOctEncryptionKey as _getOctEncryptionKey } from "../key-types/get-oct-keys.js";
import { getOkpEncryptionKey as _getOkpEncryptionKey } from "../key-types/get-okp-keys.js";
import { getRsaEncryptionKey as _getRsaEncryptionKey } from "../key-types/get-rsa-keys.js";
import {
  TEST_EC_KEY,
  TEST_OCT_KEY,
  TEST_OKP_KEY,
  TEST_RSA_KEY,
} from "../../../__fixtures__/keys.js";
import { getEncryptionKey } from "./get-encryption-key.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../key-types/get-ec-keys.js");
vi.mock("../key-types/get-oct-keys.js");
vi.mock("../key-types/get-okp-keys.js");
vi.mock("../key-types/get-rsa-keys.js");

const getEcEncryptionKey = _getEcEncryptionKey as Mock;
const getOctEncryptionKey = _getOctEncryptionKey as Mock;
const getOkpEncryptionKey = _getOkpEncryptionKey as Mock;
const getRsaEncryptionKey = _getRsaEncryptionKey as Mock;

describe("getEncryptionKeys", () => {
  beforeEach(() => {
    getEcEncryptionKey.mockReturnValue("getEcEncryptionKey");
    getOctEncryptionKey.mockReturnValue("getOctEncryptionKey");
    getOkpEncryptionKey.mockReturnValue("getOkpEncryptionKey");
    getRsaEncryptionKey.mockReturnValue("getRsaEncryptionKey");
  });

  afterEach(vi.clearAllMocks);

  test("should resolve encryption keys with EC key", () => {
    expect(
      getEncryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_EC_KEY,
      }),
    ).toEqual("getEcEncryptionKey");
  });

  test("should resolve encryption keys with OCT key", () => {
    expect(
      getEncryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_OCT_KEY,
      }),
    ).toEqual("getOctEncryptionKey");
  });

  test("should resolve encryption keys with OKP key", () => {
    expect(
      getEncryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_OKP_KEY,
      }),
    ).toEqual("getOkpEncryptionKey");
  });

  test("should resolve encryption keys with RSA key", () => {
    expect(
      getEncryptionKey({
        encryption: "A256GCM",
        kryptos: TEST_RSA_KEY,
      }),
    ).toEqual("getRsaEncryptionKey");
  });
});
