import { parseAes } from "./parse-aes";
import { AesError } from "../errors";
import { AesDecryptionRecord, SerialisedAesDecryption } from "../types";
import { isAesBufferData, isAesSerialisedData, isAesTokenised } from "./is-aes";
import {
  parseEncodedAesString,
  parseSerialisedAesRecord,
  parseTokenisedAesString,
} from "./private";

jest.mock("./is-aes");
jest.mock("./private");

const mockIsAesBufferData = isAesBufferData as jest.MockedFunction<
  typeof isAesBufferData
>;
const mockIsAesSerialisedData = isAesSerialisedData as jest.MockedFunction<
  typeof isAesSerialisedData
>;
const mockIsAesTokenised = isAesTokenised as jest.MockedFunction<typeof isAesTokenised>;
const mockParseEncodedAesString = parseEncodedAesString as jest.MockedFunction<
  typeof parseEncodedAesString
>;
const mockParseSerialisedAesRecord = parseSerialisedAesRecord as jest.MockedFunction<
  typeof parseSerialisedAesRecord
>;
const mockParseTokenisedAesString = parseTokenisedAesString as jest.MockedFunction<
  typeof parseTokenisedAesString
>;

describe("parseAes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("encoded string (non-tokenised)", () => {
    it("should parse encoded string when input is string and not tokenised", () => {
      const encodedString = "ATgkYzAzYjU4OWItMTI0ZC00NWViLTgzNzY=";
      const expectedRecord: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
      };

      mockIsAesTokenised.mockReturnValue(false);
      mockParseEncodedAesString.mockReturnValue(expectedRecord as any);

      const result = parseAes(encodedString);

      expect(mockIsAesTokenised).toHaveBeenCalledWith(encodedString);
      expect(mockParseEncodedAesString).toHaveBeenCalledWith(encodedString);
      expect(result).toEqual(expectedRecord);
    });
  });

  describe("tokenised string", () => {
    it("should parse tokenised string when input is string and tokenised", () => {
      const tokenisedString = "$v=1$alg=A256GCM$data$";
      const expectedRecord: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
      };

      mockIsAesTokenised.mockReturnValue(true);
      mockParseTokenisedAesString.mockReturnValue(expectedRecord as any);

      const result = parseAes(tokenisedString);

      expect(mockIsAesTokenised).toHaveBeenCalledWith(tokenisedString);
      expect(mockParseTokenisedAesString).toHaveBeenCalledWith(tokenisedString);
      expect(result).toEqual(expectedRecord);
    });
  });

  describe("buffer data object", () => {
    it("should return buffer data object when input is object with buffers", () => {
      const bufferData: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
      };

      mockIsAesBufferData.mockReturnValue(true);

      const result = parseAes(bufferData);

      expect(mockIsAesBufferData).toHaveBeenCalledWith(bufferData);
      expect(result).toBe(bufferData);
    });
  });

  describe("serialised data object", () => {
    it("should parse serialised data object when input is object without buffers", () => {
      const serialisedData: SerialisedAesDecryption = {
        content: "dGVzdA==",
        encryption: "A256GCM",
        initialisationVector: "aXY=",
      };
      const expectedRecord: AesDecryptionRecord = {
        content: Buffer.from("test"),
        encryption: "A256GCM",
        initialisationVector: Buffer.from("iv"),
      };

      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(true);
      mockParseSerialisedAesRecord.mockReturnValue(expectedRecord);

      const result = parseAes(serialisedData);

      expect(mockIsAesBufferData).toHaveBeenCalledWith(serialisedData);
      expect(mockIsAesSerialisedData).toHaveBeenCalledWith(serialisedData);
      expect(mockParseSerialisedAesRecord).toHaveBeenCalledWith(serialisedData);
      expect(result).toEqual(expectedRecord);
    });
  });

  describe("invalid data", () => {
    it("should throw AesError when input is a number", () => {
      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes(123 as any)).toThrow(AesError);
      expect(() => parseAes(123 as any)).toThrow("Invalid AES data");
    });

    it("should throw AesError when input is null", () => {
      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes(null as any)).toThrow(AesError);
      expect(() => parseAes(null as any)).toThrow("Invalid AES data");
    });

    it("should throw AesError when input is undefined", () => {
      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes(undefined as any)).toThrow(AesError);
      expect(() => parseAes(undefined as any)).toThrow("Invalid AES data");
    });

    it("should throw AesError when input is an array", () => {
      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes([] as any)).toThrow(AesError);
      expect(() => parseAes([] as any)).toThrow("Invalid AES data");
    });

    it("should throw AesError when input object does not match any type", () => {
      const invalidObject = { foo: "bar" };

      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes(invalidObject as any)).toThrow(AesError);
      expect(() => parseAes(invalidObject as any)).toThrow("Invalid AES data");
    });
  });
});
