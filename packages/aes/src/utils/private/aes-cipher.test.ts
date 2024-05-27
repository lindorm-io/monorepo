import { AesError } from "../../errors";
import {
  assertAesCipher,
  decryptAesCipher,
  encryptAesCipher,
  verifyAesCipher,
} from "./aes-cipher";
import {
  decryptAesData as _decryptAesData,
  encryptAesData as _encryptAesData,
} from "./aes-data";
import { decodeAesString as _decodeAesString } from "./decode-aes-string";
import { encodeAesString as _encodeAesString } from "./encode-aes-string";

jest.mock("./aes-data");
jest.mock("./decode-aes-string");
jest.mock("./encode-aes-string");

const decryptAesData = _decryptAesData as jest.Mock;
const encryptAesData = _encryptAesData as jest.Mock;
const decodeAesString = _decodeAesString as jest.Mock;
const encodeAesString = _encodeAesString as jest.Mock;

describe("aes-cipher", () => {
  let kryptos: any;

  beforeEach(() => {
    kryptos = "kryptos";

    decryptAesData.mockReturnValue("decryptAesData");
    encryptAesData.mockReturnValue("encryptAesData");
    decodeAesString.mockReturnValue("decodeAesString");
    encodeAesString.mockReturnValue("encodeAesString");
  });

  test("should encrypt aes cipher", () => {
    expect(encryptAesCipher({ data: "data", kryptos })).toEqual("encodeAesString");
  });

  test("should decrypt aes cipher", () => {
    expect(decryptAesCipher({ cipher: "cipher", kryptos })).toEqual("decryptAesData");
  });

  test("should verify valid aes cipher", () => {
    expect(
      verifyAesCipher({ cipher: "cipher", data: "decryptAesData", kryptos }),
    ).toEqual(true);
  });

  test("should verify invalid aes cipher", () => {
    expect(verifyAesCipher({ cipher: "cipher", data: "wrong", kryptos })).toEqual(false);
  });

  test("should assert valid aes cipher", () => {
    expect(() =>
      assertAesCipher({ cipher: "cipher", data: "decryptAesData", kryptos }),
    ).not.toThrow(AesError);
  });

  test("should assert invalid aes cipher", () => {
    expect(() => assertAesCipher({ cipher: "cipher", data: "wrong", kryptos })).toThrow(
      AesError,
    );
  });
});
