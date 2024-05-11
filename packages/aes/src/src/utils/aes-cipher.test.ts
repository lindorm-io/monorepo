import { AesError } from "../errors";
import { assertAesCipher, decryptAesCipher, encryptAesCipher, verifyAesCipher } from "./aes-cipher";
import { decryptAesData as _decryptAesData, encryptAesData as _encryptAesData } from "./aes-data";
import { _decodeAesString } from "./private/decode-aes-string";
import { _encodeAesString } from "./private/encode-aes-string";

jest.mock("./aes-data");
jest.mock("./private/decode-aes-string");
jest.mock("./private/encode-aes-string");

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
    expect(encryptAesCipher({ data: "data", kryptos })).toBe("encodeAesString");
  });

  test("should decrypt aes cipher", () => {
    expect(decryptAesCipher({ cipher: "cipher", kryptos })).toBe("decryptAesData");
  });

  test("should verify valid aes cipher", () => {
    expect(verifyAesCipher({ cipher: "cipher", data: "decryptAesData", kryptos })).toBe(true);
  });

  test("should verify invalid aes cipher", () => {
    expect(verifyAesCipher({ cipher: "cipher", data: "wrong", kryptos })).toBe(false);
  });

  test("should assert valid aes cipher", () => {
    expect(() =>
      assertAesCipher({ cipher: "cipher", data: "decryptAesData", kryptos }),
    ).not.toThrow(AesError);
  });

  test("should assert invalid aes cipher", () => {
    expect(() => assertAesCipher({ cipher: "cipher", data: "wrong", kryptos })).toThrow(AesError);
  });
});
