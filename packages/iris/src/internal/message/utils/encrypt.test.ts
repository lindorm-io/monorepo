import { IrisNotSupportedError } from "../../../errors/IrisNotSupportedError";
import { IrisSerializationError } from "../../../errors/IrisSerializationError";
import { decryptPayload, encryptPayload } from "./encrypt";

const mockEncrypt = jest.fn();
const mockDecrypt = jest.fn();
const mockParseAes = jest.fn();

jest.mock("@lindorm/aes", () => ({
  AesKit: jest.fn().mockImplementation(() => ({
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
  })),
  parseAes: (data: unknown) => mockParseAes(data),
}));

const predicate = { algorithm: "aes-256-gcm", purpose: "encryption" } as any;

describe("encryptPayload", () => {
  const mockAmphora = {
    find: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAmphora.find.mockResolvedValue({ id: "key-1" });
    mockEncrypt.mockReturnValue("encrypted-token-string");
    mockDecrypt.mockReturnValue("original-data");
  });

  it("should encrypt data and return tokenised string", async () => {
    const data = Buffer.from("secret payload");
    const result = await encryptPayload(data, mockAmphora, predicate);

    expect(result).toBe("encrypted-token-string");
    expect(mockAmphora.find).toHaveBeenCalledWith(predicate);
    expect(mockEncrypt).toHaveBeenCalledWith(
      Buffer.from("secret payload").toString("base64"),
      "tokenised",
    );
  });

  it("should throw IrisNotSupportedError when amphora is not provided", async () => {
    await expect(
      encryptPayload(Buffer.from("data"), undefined, predicate),
    ).rejects.toThrow(IrisNotSupportedError);
  });

  it("should throw IrisNotSupportedError when amphora is null", async () => {
    await expect(encryptPayload(Buffer.from("data"), null, predicate)).rejects.toThrow(
      IrisNotSupportedError,
    );
  });

  it("should wrap unexpected errors in IrisSerializationError", async () => {
    mockAmphora.find.mockRejectedValue(new Error("key not found"));

    await expect(
      encryptPayload(Buffer.from("data"), mockAmphora, predicate),
    ).rejects.toThrow(IrisSerializationError);
  });
});

describe("decryptPayload", () => {
  const mockAmphora = {
    find: jest.fn(),
    findById: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAmphora.findById.mockResolvedValue({ id: "key-1" });
    mockParseAes.mockReturnValue({ keyId: "key-1" });
    mockDecrypt.mockReturnValue(Buffer.from("decrypted-data").toString("base64"));
  });

  it("should decrypt tokenised string and return Buffer", async () => {
    const result = await decryptPayload("encrypted-token", mockAmphora);

    expect(result).toEqual(Buffer.from("decrypted-data"));
    expect(mockParseAes).toHaveBeenCalledWith("encrypted-token");
    expect(mockAmphora.findById).toHaveBeenCalledWith("key-1");
    expect(mockDecrypt).toHaveBeenCalledWith("encrypted-token");
  });

  it("should throw IrisNotSupportedError when amphora is not provided", async () => {
    await expect(decryptPayload("token", undefined)).rejects.toThrow(
      IrisNotSupportedError,
    );
  });

  it("should wrap unexpected errors in IrisSerializationError", async () => {
    mockAmphora.findById.mockRejectedValue(new Error("key not found"));

    await expect(decryptPayload("token", mockAmphora)).rejects.toThrow(
      IrisSerializationError,
    );
  });

  it("should round-trip with encryptPayload", async () => {
    const originalText = "original-text";
    const b64 = Buffer.from(originalText).toString("base64");

    // encrypt receives base64, returns a token
    mockEncrypt.mockReturnValue("round-trip-token");
    // decrypt returns the base64 string, which decryptPayload converts back to Buffer
    mockDecrypt.mockReturnValue(b64);

    const original = Buffer.from(originalText);
    const encrypted = await encryptPayload(original, mockAmphora, predicate);
    const decrypted = await decryptPayload(encrypted, mockAmphora);

    expect(decrypted).toEqual(original);
  });
});
