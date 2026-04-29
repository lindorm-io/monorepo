import { AesError } from "../../../errors/AesError.js";
import type {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key.js";
import {
  getDiffieHellmanDecryptionKey as _getDiffieHellmanDecryptionKey,
  getDiffieHellmanEncryptionKey as _getDiffieHellmanEncryptionKey,
} from "../diffie-hellman/diffie-hellman.js";
import {
  getDiffieHellmanKeyWrapDecryptionKey as _getDiffieHellmanKeyWrapDecryptionKey,
  getDiffieHellmanKeyWrapEncryptionKey as _getDiffieHellmanKeyWrapEncryptionKey,
} from "../diffie-hellman/diffie-hellman-key-wrap.js";
import { getOkpDecryptionKey, getOkpEncryptionKey } from "./get-okp-keys.js";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../diffie-hellman/diffie-hellman.js");
vi.mock("../diffie-hellman/diffie-hellman-key-wrap.js");

const getDiffieHellmanDecryptionKey = _getDiffieHellmanDecryptionKey as Mock;
const getDiffieHellmanEncryptionKey = _getDiffieHellmanEncryptionKey as Mock;
const getDiffieHellmanKeyWrapDecryptionKey =
  _getDiffieHellmanKeyWrapDecryptionKey as Mock;
const getDiffieHellmanKeyWrapEncryptionKey =
  _getDiffieHellmanKeyWrapEncryptionKey as Mock;

describe("get-okp-keys", () => {
  const mockEncryptionResult: CreateCekResult = {
    contentEncryptionKey: Buffer.from("mock-cek"),
    publicEncryptionKey: Buffer.from("mock-pek"),
  };

  const mockDecryptionResult: DecryptCekResult = {
    contentEncryptionKey: Buffer.from("mock-cek"),
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getOkpEncryptionKey", () => {
    beforeEach(() => {
      getDiffieHellmanEncryptionKey.mockReturnValue(mockEncryptionResult);
      getDiffieHellmanKeyWrapEncryptionKey.mockReturnValue(mockEncryptionResult);
    });

    test("should route ECDH-ES to getDiffieHellmanEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "ECDH-ES",
          toJSON: () => ({ algorithm: "ECDH-ES" }),
        } as any,
      };

      const result = getOkpEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getDiffieHellmanEncryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanEncryptionKey).toHaveBeenCalledTimes(1);
      expect(getDiffieHellmanKeyWrapEncryptionKey).not.toHaveBeenCalled();
    });

    test("should route ECDH-ES+A128KW to getDiffieHellmanKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "ECDH-ES+A128KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A128KW" }),
        } as any,
      };

      const result = getOkpEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
      expect(getDiffieHellmanEncryptionKey).not.toHaveBeenCalled();
    });

    test("should route ECDH-ES+A192KW to getDiffieHellmanKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "ECDH-ES+A192KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A192KW" }),
        } as any,
      };

      const result = getOkpEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A256KW to getDiffieHellmanKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "ECDH-ES+A256KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A256KW" }),
        } as any,
      };

      const result = getOkpEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A128GCMKW to getDiffieHellmanKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "ECDH-ES+A128GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A128GCMKW" }),
        } as any,
      };

      const result = getOkpEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A192GCMKW to getDiffieHellmanKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "ECDH-ES+A192GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A192GCMKW" }),
        } as any,
      };

      const result = getOkpEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A256GCMKW to getDiffieHellmanKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "ECDH-ES+A256GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A256GCMKW" }),
        } as any,
      };

      const result = getOkpEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should throw AesError for unknown algorithm", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "UNKNOWN" as any,
          toJSON: () => ({ algorithm: "UNKNOWN" }),
        } as any,
      };

      expect(() => getOkpEncryptionKey(options)).toThrow(AesError);
      expect(() => getOkpEncryptionKey(options)).toThrow("Unexpected Kryptos");
      expect(getDiffieHellmanEncryptionKey).not.toHaveBeenCalled();
      expect(getDiffieHellmanKeyWrapEncryptionKey).not.toHaveBeenCalled();
    });
  });

  describe("getOkpDecryptionKey", () => {
    beforeEach(() => {
      getDiffieHellmanDecryptionKey.mockReturnValue(mockDecryptionResult);
      getDiffieHellmanKeyWrapDecryptionKey.mockReturnValue(mockDecryptionResult);
    });

    test("should route ECDH-ES to getDiffieHellmanDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "ECDH-ES",
          toJSON: () => ({ algorithm: "ECDH-ES" }),
        } as any,
      };

      const result = getOkpDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getDiffieHellmanDecryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanDecryptionKey).toHaveBeenCalledTimes(1);
      expect(getDiffieHellmanKeyWrapDecryptionKey).not.toHaveBeenCalled();
    });

    test("should route ECDH-ES+A128KW to getDiffieHellmanKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "ECDH-ES+A128KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A128KW" }),
        } as any,
      };

      const result = getOkpDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
      expect(getDiffieHellmanDecryptionKey).not.toHaveBeenCalled();
    });

    test("should route ECDH-ES+A192KW to getDiffieHellmanKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "ECDH-ES+A192KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A192KW" }),
        } as any,
      };

      const result = getOkpDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A256KW to getDiffieHellmanKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "ECDH-ES+A256KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A256KW" }),
        } as any,
      };

      const result = getOkpDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A128GCMKW to getDiffieHellmanKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "ECDH-ES+A128GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A128GCMKW" }),
        } as any,
      };

      const result = getOkpDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A192GCMKW to getDiffieHellmanKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "ECDH-ES+A192GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A192GCMKW" }),
        } as any,
      };

      const result = getOkpDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A256GCMKW to getDiffieHellmanKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "ECDH-ES+A256GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A256GCMKW" }),
        } as any,
      };

      const result = getOkpDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getDiffieHellmanKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should throw AesError for unknown algorithm", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "UNKNOWN" as any,
          toJSON: () => ({ algorithm: "UNKNOWN" }),
        } as any,
      };

      expect(() => getOkpDecryptionKey(options)).toThrow(AesError);
      expect(() => getOkpDecryptionKey(options)).toThrow("Unexpected Kryptos");
      expect(getDiffieHellmanDecryptionKey).not.toHaveBeenCalled();
      expect(getDiffieHellmanKeyWrapDecryptionKey).not.toHaveBeenCalled();
    });
  });
});
