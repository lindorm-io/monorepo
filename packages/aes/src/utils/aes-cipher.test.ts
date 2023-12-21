import { AesError } from "../errors";
import { assertAesCipher, decryptAesCipher, encryptAesCipher, verifyAesCipher } from "./aes-cipher";
import { decryptAesData as _decryptAesData, encryptAesData as _encryptAesData } from "./aes-data";
import {
  decodeAesString as _decodeAesString,
  encodeAesString as _encodeAesString,
} from "./private";

jest.mock("./aes-data");
jest.mock("./private");

const decryptAesData = _decryptAesData as jest.Mock;
const encryptAesData = _encryptAesData as jest.Mock;
const decodeAesString = _decodeAesString as jest.Mock;
const encodeAesString = _encodeAesString as jest.Mock;

describe("aes-cipher", () => {
  beforeEach(() => {
    decryptAesData.mockReturnValue("decryptAesData");
    encryptAesData.mockReturnValue("encryptAesData");
    decodeAesString.mockReturnValue("decodeAesString");
    encodeAesString.mockReturnValue("encodeAesString");
  });

  test("should encrypt aes cipher", () => {
    expect(encryptAesCipher({ data: "data" })).toBe("encodeAesString");
  });

  test("should decrypt aes cipher", () => {
    expect(decryptAesCipher({ cipher: "cipher" })).toBe("decryptAesData");
  });

  test("should verify valid aes cipher", () => {
    expect(verifyAesCipher({ cipher: "cipher", data: "decryptAesData" })).toBe(true);
  });

  test("should verify invalid aes cipher", () => {
    expect(verifyAesCipher({ cipher: "cipher", data: "wrong" })).toBe(false);
  });

  test("should assert valid aes cipher", () => {
    expect(() => assertAesCipher({ cipher: "cipher", data: "decryptAesData" })).not.toThrow(
      AesError,
    );
  });

  test("should assert invalid aes cipher", () => {
    expect(() => assertAesCipher({ cipher: "cipher", data: "wrong" })).toThrow(AesError);
  });
});
