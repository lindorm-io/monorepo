import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import {
  getOctDirDecryptionKey as _getOctDirDecryptionKey,
  getOctDirEncryptionKey as _getOctDirEncryptionKey,
  getOctKeyWrapDecryptionKey as _getOctKeyWrapDecryptionKey,
  getOctKeyWrapEncryptionKey as _getOctKeyWrapEncryptionKey,
  getOctPbkdfKeyWrapDecryptionKey as _getOctPbkdfKeyWrapDecryptionKey,
  getOctPbkdfKeyWrapEncryptionKey as _getOctPbkdfKeyWrapEncryptionKey,
} from "../oct";
import { getOctDecryptionKey, getOctEncryptionKey } from "./get-oct-keys";

jest.mock("../oct");

const getOctDirDecryptionKey = _getOctDirDecryptionKey as jest.Mock;
const getOctDirEncryptionKey = _getOctDirEncryptionKey as jest.Mock;
const getOctKeyWrapDecryptionKey = _getOctKeyWrapDecryptionKey as jest.Mock;
const getOctKeyWrapEncryptionKey = _getOctKeyWrapEncryptionKey as jest.Mock;
const getOctPbkdfKeyWrapDecryptionKey = _getOctPbkdfKeyWrapDecryptionKey as jest.Mock;
const getOctPbkdfKeyWrapEncryptionKey = _getOctPbkdfKeyWrapEncryptionKey as jest.Mock;

describe("get-oct-keys", () => {
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

  describe("getOctEncryptionKey", () => {
    beforeEach(() => {
      getOctDirEncryptionKey.mockReturnValue(mockEncryptionResult);
      getOctKeyWrapEncryptionKey.mockReturnValue(mockEncryptionResult);
      getOctPbkdfKeyWrapEncryptionKey.mockReturnValue(mockEncryptionResult);
    });

    test("should route dir to getOctDirEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "dir",
          toJSON: () => ({ algorithm: "dir" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctDirEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctDirEncryptionKey).toHaveBeenCalledTimes(1);
      expect(getOctKeyWrapEncryptionKey).not.toHaveBeenCalled();
      expect(getOctPbkdfKeyWrapEncryptionKey).not.toHaveBeenCalled();
    });

    test("should route A128KW to getOctKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "A128KW",
          toJSON: () => ({ algorithm: "A128KW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
      expect(getOctDirEncryptionKey).not.toHaveBeenCalled();
      expect(getOctPbkdfKeyWrapEncryptionKey).not.toHaveBeenCalled();
    });

    test("should route A192KW to getOctKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "A192KW",
          toJSON: () => ({ algorithm: "A192KW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route A256KW to getOctKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "A256KW",
          toJSON: () => ({ algorithm: "A256KW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route A128GCMKW to getOctKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "A128GCMKW",
          toJSON: () => ({ algorithm: "A128GCMKW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route A192GCMKW to getOctKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "A192GCMKW",
          toJSON: () => ({ algorithm: "A192GCMKW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route A256GCMKW to getOctKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "A256GCMKW",
          toJSON: () => ({ algorithm: "A256GCMKW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route PBES2-HS256+A128KW to getOctPbkdfKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "PBES2-HS256+A128KW",
          toJSON: () => ({ algorithm: "PBES2-HS256+A128KW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctPbkdfKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctPbkdfKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
      expect(getOctDirEncryptionKey).not.toHaveBeenCalled();
      expect(getOctKeyWrapEncryptionKey).not.toHaveBeenCalled();
    });

    test("should route PBES2-HS384+A192KW to getOctPbkdfKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "PBES2-HS384+A192KW",
          toJSON: () => ({ algorithm: "PBES2-HS384+A192KW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctPbkdfKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctPbkdfKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route PBES2-HS512+A256KW to getOctPbkdfKeyWrapEncryptionKey", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "PBES2-HS512+A256KW",
          toJSON: () => ({ algorithm: "PBES2-HS512+A256KW" }),
        } as any,
      };

      const result = getOctEncryptionKey(options);

      expect(result).toBe(mockEncryptionResult);
      expect(getOctPbkdfKeyWrapEncryptionKey).toHaveBeenCalledWith(options);
      expect(getOctPbkdfKeyWrapEncryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should throw AesError for unknown algorithm", () => {
      const options: CreateCekOptions = {
        encryption: "A256GCM",
        kryptos: {
          algorithm: "UNKNOWN" as any,
          toJSON: () => ({ algorithm: "UNKNOWN" }),
        } as any,
      };

      expect(() => getOctEncryptionKey(options)).toThrow(AesError);
      expect(() => getOctEncryptionKey(options)).toThrow("Unexpected Kryptos");
      expect(getOctDirEncryptionKey).not.toHaveBeenCalled();
      expect(getOctKeyWrapEncryptionKey).not.toHaveBeenCalled();
      expect(getOctPbkdfKeyWrapEncryptionKey).not.toHaveBeenCalled();
    });
  });

  describe("getOctDecryptionKey", () => {
    beforeEach(() => {
      getOctDirDecryptionKey.mockReturnValue(mockDecryptionResult);
      getOctKeyWrapDecryptionKey.mockReturnValue(mockDecryptionResult);
      getOctPbkdfKeyWrapDecryptionKey.mockReturnValue(mockDecryptionResult);
    });

    test("should route dir to getOctDirDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "dir",
          toJSON: () => ({ algorithm: "dir" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctDirDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctDirDecryptionKey).toHaveBeenCalledTimes(1);
      expect(getOctKeyWrapDecryptionKey).not.toHaveBeenCalled();
      expect(getOctPbkdfKeyWrapDecryptionKey).not.toHaveBeenCalled();
    });

    test("should route A128KW to getOctKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "A128KW",
          toJSON: () => ({ algorithm: "A128KW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
      expect(getOctDirDecryptionKey).not.toHaveBeenCalled();
      expect(getOctPbkdfKeyWrapDecryptionKey).not.toHaveBeenCalled();
    });

    test("should route A192KW to getOctKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "A192KW",
          toJSON: () => ({ algorithm: "A192KW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route A256KW to getOctKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "A256KW",
          toJSON: () => ({ algorithm: "A256KW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route A128GCMKW to getOctKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "A128GCMKW",
          toJSON: () => ({ algorithm: "A128GCMKW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route A192GCMKW to getOctKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "A192GCMKW",
          toJSON: () => ({ algorithm: "A192GCMKW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route A256GCMKW to getOctKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "A256GCMKW",
          toJSON: () => ({ algorithm: "A256GCMKW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route PBES2-HS256+A128KW to getOctPbkdfKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "PBES2-HS256+A128KW",
          toJSON: () => ({ algorithm: "PBES2-HS256+A128KW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctPbkdfKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctPbkdfKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
      expect(getOctDirDecryptionKey).not.toHaveBeenCalled();
      expect(getOctKeyWrapDecryptionKey).not.toHaveBeenCalled();
    });

    test("should route PBES2-HS384+A192KW to getOctPbkdfKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "PBES2-HS384+A192KW",
          toJSON: () => ({ algorithm: "PBES2-HS384+A192KW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctPbkdfKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctPbkdfKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
    });

    test("should route PBES2-HS512+A256KW to getOctPbkdfKeyWrapDecryptionKey", () => {
      const options: DecryptCekOptions = {
        encryption: "A256GCM",
        publicEncryptionKey: Buffer.from("mock-pek"),
        kryptos: {
          algorithm: "PBES2-HS512+A256KW",
          toJSON: () => ({ algorithm: "PBES2-HS512+A256KW" }),
        } as any,
      };

      const result = getOctDecryptionKey(options);

      expect(result).toBe(mockDecryptionResult);
      expect(getOctPbkdfKeyWrapDecryptionKey).toHaveBeenCalledWith(options);
      expect(getOctPbkdfKeyWrapDecryptionKey).toHaveBeenCalledTimes(1);
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

      expect(() => getOctDecryptionKey(options)).toThrow(AesError);
      expect(() => getOctDecryptionKey(options)).toThrow("Unexpected Kryptos");
      expect(getOctDirDecryptionKey).not.toHaveBeenCalled();
      expect(getOctKeyWrapDecryptionKey).not.toHaveBeenCalled();
      expect(getOctPbkdfKeyWrapDecryptionKey).not.toHaveBeenCalled();
    });
  });
});
