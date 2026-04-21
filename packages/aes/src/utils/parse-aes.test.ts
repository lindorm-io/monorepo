import { parseAes } from "./parse-aes.js";
import { AesError } from "../errors/index.js";
import type {
  AesDecryptionRecord,
  ParsedAesDecryptionRecord,
  SerialisedAesDecryption,
} from "../types/index.js";
import { createTestAesDecryptionRecord } from "./__fixtures__/aes-decryption-record.js";
import { isAesBufferData, isAesSerialisedData, isAesTokenised } from "./is-aes.js";
import { parseEncodedAesString } from "../internal/utils/encoded-aes.js";
import { parseSerialisedAesRecord } from "../internal/utils/serialised-aes.js";
import { parseTokenisedAesString } from "../internal/utils/tokenised-aes.js";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

vi.mock("./is-aes.js");
vi.mock("../internal/utils/encoded-aes.js");
vi.mock("../internal/utils/serialised-aes.js");
vi.mock("../internal/utils/tokenised-aes.js");

const mockIsAesBufferData = isAesBufferData as MockedFunction<typeof isAesBufferData>;
const mockIsAesSerialisedData = isAesSerialisedData as MockedFunction<
  typeof isAesSerialisedData
>;
const mockIsAesTokenised = isAesTokenised as MockedFunction<typeof isAesTokenised>;
const mockParseEncodedAesString = parseEncodedAesString as MockedFunction<
  typeof parseEncodedAesString
>;
const mockParseSerialisedAesRecord = parseSerialisedAesRecord as MockedFunction<
  typeof parseSerialisedAesRecord
>;
const mockParseTokenisedAesString = parseTokenisedAesString as MockedFunction<
  typeof parseTokenisedAesString
>;

describe("parseAes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tokenised string", () => {
    test("should parse tokenised string when input starts with 'aes:'", () => {
      const tokenisedString = "aes:header$iv$tag$ciphertext";
      const expectedRecord: AesDecryptionRecord = createTestAesDecryptionRecord();

      mockIsAesTokenised.mockReturnValue(true);
      mockParseTokenisedAesString.mockReturnValue(expectedRecord as any);

      const result = parseAes(tokenisedString);

      expect(mockIsAesTokenised).toHaveBeenCalledWith(tokenisedString);
      expect(mockParseTokenisedAesString).toHaveBeenCalledWith(tokenisedString);
      expect(result).toEqual(expectedRecord);
    });
  });

  describe("encoded string (non-tokenised)", () => {
    test("should parse encoded string when input is string and not tokenised", () => {
      const encodedString = "ATgkYzAzYjU4OWItMTI0ZC00NWViLTgzNzY";
      const expectedRecord: AesDecryptionRecord = createTestAesDecryptionRecord();

      mockIsAesTokenised.mockReturnValue(false);
      mockParseEncodedAesString.mockReturnValue(expectedRecord as any);

      const result = parseAes(encodedString);

      expect(mockIsAesTokenised).toHaveBeenCalledWith(encodedString);
      expect(mockParseEncodedAesString).toHaveBeenCalledWith(encodedString);
      expect(result).toEqual(expectedRecord);
    });
  });

  describe("buffer data object", () => {
    test("should return buffer data object when input is object with buffers", () => {
      const bufferData: AesDecryptionRecord = createTestAesDecryptionRecord();

      mockIsAesBufferData.mockReturnValue(true);

      const result = parseAes(bufferData);

      expect(mockIsAesBufferData).toHaveBeenCalledWith(bufferData);
      expect(result).toBe(bufferData);
    });
  });

  describe("serialised data object", () => {
    test("should parse serialised data object when input is object without buffers", () => {
      const serialisedData: SerialisedAesDecryption = {
        ciphertext: "dGVzdA",
        header: "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIiwidiI6IjEuMCJ9",
        iv: "aXY",
        tag: "dGFn",
        v: "1.0",
      };
      const expectedRecord = createTestAesDecryptionRecord({
        aad: Buffer.from("aad"),
      }) as ParsedAesDecryptionRecord;

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
    test("should throw AesError when input is a number", () => {
      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes(123 as any)).toThrow(AesError);
      expect(() => parseAes(123 as any)).toThrow("Invalid AES data");
    });

    test("should throw AesError when input is null", () => {
      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes(null as any)).toThrow(AesError);
      expect(() => parseAes(null as any)).toThrow("Invalid AES data");
    });

    test("should throw AesError when input is undefined", () => {
      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes(undefined as any)).toThrow(AesError);
      expect(() => parseAes(undefined as any)).toThrow("Invalid AES data");
    });

    test("should throw AesError when input is an array", () => {
      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes([] as any)).toThrow(AesError);
      expect(() => parseAes([] as any)).toThrow("Invalid AES data");
    });

    test("should throw AesError when input object does not match any type", () => {
      const invalidObject = { foo: "bar" };

      mockIsAesBufferData.mockReturnValue(false);
      mockIsAesSerialisedData.mockReturnValue(false);

      expect(() => parseAes(invalidObject as any)).toThrow(AesError);
      expect(() => parseAes(invalidObject as any)).toThrow("Invalid AES data");
    });
  });
});
