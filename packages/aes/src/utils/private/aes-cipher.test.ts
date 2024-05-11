import { AesError } from "../../errors";
import {
  _assertAesCipher,
  _decryptAesCipher,
  _encryptAesCipher,
  _verifyAesCipher,
} from "./aes-cipher";
import { _decryptAesData, _encryptAesData } from "./aes-data";
import { _decodeAesString } from "./decode-aes-string";
import { _encodeAesString } from "./encode-aes-string";

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
    expect(_encryptAesCipher({ data: "data", kryptos })).toBe("encodeAesString");
  });

  test("should decrypt aes cipher", () => {
    expect(_decryptAesCipher({ cipher: "cipher", kryptos })).toBe("decryptAesData");
  });

  test("should verify valid aes cipher", () => {
    expect(_verifyAesCipher({ cipher: "cipher", data: "decryptAesData", kryptos })).toBe(true);
  });

  test("should verify invalid aes cipher", () => {
    expect(_verifyAesCipher({ cipher: "cipher", data: "wrong", kryptos })).toBe(false);
  });

  test("should assert valid aes cipher", () => {
    expect(() =>
      _assertAesCipher({ cipher: "cipher", data: "decryptAesData", kryptos }),
    ).not.toThrow(AesError);
  });

  test("should assert invalid aes cipher", () => {
    expect(() => _assertAesCipher({ cipher: "cipher", data: "wrong", kryptos })).toThrow(AesError);
  });
});
