import { parseAes } from "./parse-aes.js";
import { AesError } from "../errors/index.js";
import type {
  AesDecryptionRecord,
  ParsedAesDecryptionRecord,
  SerialisedAesDecryption,
} from "../types/index.js";
import { createTestAesDecryptionRecord } from "./__fixtures__/aes-decryption-record.js";
import { isAesBufferData, isAesSerialisedData, isAesString } from "./is-aes.js";
import { parseCborAesString } from "../internal/utils/cbor-aes.js";
import { parseSerialisedAesRecord } from "../internal/utils/serialised-aes.js";
import { beforeEach, describe, expect, test, vi, type MockedFunction } from "vitest";

vi.mock("./is-aes.js");
vi.mock("../internal/utils/cbor-aes.js");
vi.mock("../internal/utils/serialised-aes.js");

const mockIsAesBufferData = isAesBufferData as MockedFunction<typeof isAesBufferData>;
const mockIsAesSerialisedData = isAesSerialisedData as MockedFunction<
  typeof isAesSerialisedData
>;
const mockIsAesString = isAesString as MockedFunction<typeof isAesString>;
const mockParseCborAesString = parseCborAesString as MockedFunction<
  typeof parseCborAesString
>;
const mockParseSerialisedAesRecord = parseSerialisedAesRecord as MockedFunction<
  typeof parseSerialisedAesRecord
>;

describe("parseAes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cbor string", () => {
    test("should parse cbor string when input starts with 'aes:'", () => {
      const cborString = "aes:oWNmb28";
      const expectedRecord: AesDecryptionRecord = createTestAesDecryptionRecord();

      mockIsAesString.mockReturnValue(true);
      mockParseCborAesString.mockReturnValue(expectedRecord as any);

      const result = parseAes(cborString);

      expect(mockIsAesString).toHaveBeenCalledWith(cborString);
      expect(mockParseCborAesString).toHaveBeenCalledWith(cborString);
      expect(result).toEqual(expectedRecord);
    });

    test("should throw AesError for a string without the 'aes:' prefix", () => {
      mockIsAesString.mockReturnValue(false);

      expect(() => parseAes("not-an-aes-string")).toThrow(AesError);
      expect(() => parseAes("not-an-aes-string")).toThrow("Invalid AES data");
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
