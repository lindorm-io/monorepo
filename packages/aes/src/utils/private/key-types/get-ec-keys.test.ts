import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import {
  getDiffieHellmanDecryptionKey as _getDiffieHellmanDecryptionKey,
  getDiffieHellmanEncryptionKey as _getDiffieHellmanEncryptionKey,
  getDiffieHellmanKeyWrapDecryptionKey as _getDiffieHellmanKeyWrapDecryptionKey,
  getDiffieHellmanKeyWrapEncryptionKey as _getDiffieHellmanKeyWrapEncryptionKey,
} from "../diffie-hellman";
import { getEcDecryptionKey, getEcEncryptionKey } from "./get-ec-keys";

jest.mock("../diffie-hellman");

const getDiffieHellmanDecryptionKey = _getDiffieHellmanDecryptionKey as jest.Mock;
const getDiffieHellmanEncryptionKey = _getDiffieHellmanEncryptionKey as jest.Mock;
const getDiffieHellmanKeyWrapDecryptionKey =
  _getDiffieHellmanKeyWrapDecryptionKey as jest.Mock;
const getDiffieHellmanKeyWrapEncryptionKey =
  _getDiffieHellmanKeyWrapEncryptionKey as jest.Mock;

describe("get-ec-keys", () => {
  const mockEncryptionResult: CreateCekResult = {
    contentEncryptionKey: Buffer.from("mock-cek"),
    publicEncryptionKey: Buffer.from("mock-pek"),
  };

  const mockDecryptionResult: DecryptCekResult = {
    contentEncryptionKey: Buffer.from("mock-cek"),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getEcEncryptionKey", () => {
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

      const result = getEcEncryptionKey(options);

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

      const result = getEcEncryptionKey(options);

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

      const result = getEcEncryptionKey(options);

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

      const result = getEcEncryptionKey(options);

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

      const result = getEcEncryptionKey(options);

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

      const result = getEcEncryptionKey(options);

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

      const result = getEcEncryptionKey(options);

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

      expect(() => getEcEncryptionKey(options)).toThrow(AesError);
      expect(() => getEcEncryptionKey(options)).toThrow("Unexpected Kryptos");
      expect(getDiffieHellmanEncryptionKey).not.toHaveBeenCalled();
      expect(getDiffieHellmanKeyWrapEncryptionKey).not.toHaveBeenCalled();
    });
  });

  describe("getEcDecryptionKey", () => {
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

      const result = getEcDecryptionKey(options);

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

      const result = getEcDecryptionKey(options);

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

      const result = getEcDecryptionKey(options);

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

      const result = getEcDecryptionKey(options);

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

      const result = getEcDecryptionKey(options);

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

      const result = getEcDecryptionKey(options);

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

      const result = getEcDecryptionKey(options);

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

      expect(() => getEcDecryptionKey(options)).toThrow(AesError);
      expect(() => getEcDecryptionKey(options)).toThrow("Unexpected Kryptos");
      expect(getDiffieHellmanDecryptionKey).not.toHaveBeenCalled();
      expect(getDiffieHellmanKeyWrapDecryptionKey).not.toHaveBeenCalled();
    });
  });
});
