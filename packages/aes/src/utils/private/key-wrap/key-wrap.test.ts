import { AesError } from "../../../errors";
import {
  KeyUnwrapOptions,
  KeyUnwrapResult,
  KeyWrapOptions,
  KeyWrapResult,
} from "../../../types/private";
import { ecbKeyUnwrap as _ecbKeyUnwrap, ecbKeyWrap as _ecbKeyWrap } from "./ecb-key-wrap";
import { gcmKeyUnwrap as _gcmKeyUnwrap, gcmKeyWrap as _gcmKeyWrap } from "./gcm-key-wrap";
import { keyUnwrap, keyWrap } from "./key-wrap";

jest.mock("./ecb-key-wrap");
jest.mock("./gcm-key-wrap");

const ecbKeyUnwrap = _ecbKeyUnwrap as jest.Mock;
const ecbKeyWrap = _ecbKeyWrap as jest.Mock;
const gcmKeyUnwrap = _gcmKeyUnwrap as jest.Mock;
const gcmKeyWrap = _gcmKeyWrap as jest.Mock;

describe("key-wrap", () => {
  const mockKeyWrapResult: KeyWrapResult = {
    publicEncryptionKey: Buffer.from("mock-encrypted-key"),
    publicEncryptionIv: Buffer.from("mock-iv"),
    publicEncryptionTag: Buffer.from("mock-tag"),
  };

  const mockKeyUnwrapResult: KeyUnwrapResult = {
    contentEncryptionKey: Buffer.from("mock-key"),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("keyWrap", () => {
    beforeEach(() => {
      ecbKeyWrap.mockReturnValue(mockKeyWrapResult);
      gcmKeyWrap.mockReturnValue(mockKeyWrapResult);
    });

    test("should route A128KW to ecbKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A128KW",
          toJSON: () => ({ algorithm: "A128KW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(ecbKeyWrap).toHaveBeenCalledWith(options);
      expect(ecbKeyWrap).toHaveBeenCalledTimes(1);
      expect(gcmKeyWrap).not.toHaveBeenCalled();
    });

    test("should route A192KW to ecbKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A192KW",
          toJSON: () => ({ algorithm: "A192KW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(ecbKeyWrap).toHaveBeenCalledWith(options);
      expect(ecbKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route A256KW to ecbKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A256KW",
          toJSON: () => ({ algorithm: "A256KW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(ecbKeyWrap).toHaveBeenCalledWith(options);
      expect(ecbKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A128KW to ecbKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A128KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A128KW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(ecbKeyWrap).toHaveBeenCalledWith(options);
      expect(ecbKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A192KW to ecbKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A192KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A192KW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(ecbKeyWrap).toHaveBeenCalledWith(options);
      expect(ecbKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A256KW to ecbKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A256KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A256KW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(ecbKeyWrap).toHaveBeenCalledWith(options);
      expect(ecbKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route A128GCMKW to gcmKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A128GCMKW",
          toJSON: () => ({ algorithm: "A128GCMKW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(gcmKeyWrap).toHaveBeenCalledWith(options);
      expect(gcmKeyWrap).toHaveBeenCalledTimes(1);
      expect(ecbKeyWrap).not.toHaveBeenCalled();
    });

    test("should route A192GCMKW to gcmKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A192GCMKW",
          toJSON: () => ({ algorithm: "A192GCMKW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(gcmKeyWrap).toHaveBeenCalledWith(options);
      expect(gcmKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route A256GCMKW to gcmKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A256GCMKW",
          toJSON: () => ({ algorithm: "A256GCMKW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(gcmKeyWrap).toHaveBeenCalledWith(options);
      expect(gcmKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A128GCMKW to gcmKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A128GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A128GCMKW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(gcmKeyWrap).toHaveBeenCalledWith(options);
      expect(gcmKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A192GCMKW to gcmKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A192GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A192GCMKW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(gcmKeyWrap).toHaveBeenCalledWith(options);
      expect(gcmKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A256GCMKW to gcmKeyWrap", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A256GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A256GCMKW" }),
        } as any,
      };

      const result = keyWrap(options);

      expect(result).toBe(mockKeyWrapResult);
      expect(gcmKeyWrap).toHaveBeenCalledWith(options);
      expect(gcmKeyWrap).toHaveBeenCalledTimes(1);
    });

    test("should throw AesError for unsupported algorithm", () => {
      const options: KeyWrapOptions = {
        contentEncryptionKey: Buffer.from("key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "UNKNOWN" as any,
          toJSON: () => ({ algorithm: "UNKNOWN" }),
        } as any,
      };

      expect(() => keyWrap(options)).toThrow(AesError);
      expect(() => keyWrap(options)).toThrow("Unsupported key wrap algorithm");
      expect(ecbKeyWrap).not.toHaveBeenCalled();
      expect(gcmKeyWrap).not.toHaveBeenCalled();
    });
  });

  describe("keyUnwrap", () => {
    beforeEach(() => {
      ecbKeyUnwrap.mockReturnValue(mockKeyUnwrapResult);
      gcmKeyUnwrap.mockReturnValue(mockKeyUnwrapResult);
    });

    test("should route A128KW to ecbKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A128KW",
          toJSON: () => ({ algorithm: "A128KW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(ecbKeyUnwrap).toHaveBeenCalledWith(options);
      expect(ecbKeyUnwrap).toHaveBeenCalledTimes(1);
      expect(gcmKeyUnwrap).not.toHaveBeenCalled();
    });

    test("should route A192KW to ecbKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A192KW",
          toJSON: () => ({ algorithm: "A192KW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(ecbKeyUnwrap).toHaveBeenCalledWith(options);
      expect(ecbKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route A256KW to ecbKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A256KW",
          toJSON: () => ({ algorithm: "A256KW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(ecbKeyUnwrap).toHaveBeenCalledWith(options);
      expect(ecbKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A128KW to ecbKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A128KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A128KW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(ecbKeyUnwrap).toHaveBeenCalledWith(options);
      expect(ecbKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A192KW to ecbKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A192KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A192KW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(ecbKeyUnwrap).toHaveBeenCalledWith(options);
      expect(ecbKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A256KW to ecbKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A256KW",
          toJSON: () => ({ algorithm: "ECDH-ES+A256KW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(ecbKeyUnwrap).toHaveBeenCalledWith(options);
      expect(ecbKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route A128GCMKW to gcmKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A128GCMKW",
          toJSON: () => ({ algorithm: "A128GCMKW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(gcmKeyUnwrap).toHaveBeenCalledWith(options);
      expect(gcmKeyUnwrap).toHaveBeenCalledTimes(1);
      expect(ecbKeyUnwrap).not.toHaveBeenCalled();
    });

    test("should route A192GCMKW to gcmKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A192GCMKW",
          toJSON: () => ({ algorithm: "A192GCMKW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(gcmKeyUnwrap).toHaveBeenCalledWith(options);
      expect(gcmKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route A256GCMKW to gcmKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "A256GCMKW",
          toJSON: () => ({ algorithm: "A256GCMKW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(gcmKeyUnwrap).toHaveBeenCalledWith(options);
      expect(gcmKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A128GCMKW to gcmKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A128GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A128GCMKW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(gcmKeyUnwrap).toHaveBeenCalledWith(options);
      expect(gcmKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A192GCMKW to gcmKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A192GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A192GCMKW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(gcmKeyUnwrap).toHaveBeenCalledWith(options);
      expect(gcmKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should route ECDH-ES+A256GCMKW to gcmKeyUnwrap", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "ECDH-ES+A256GCMKW",
          toJSON: () => ({ algorithm: "ECDH-ES+A256GCMKW" }),
        } as any,
      };

      const result = keyUnwrap(options);

      expect(result).toBe(mockKeyUnwrapResult);
      expect(gcmKeyUnwrap).toHaveBeenCalledWith(options);
      expect(gcmKeyUnwrap).toHaveBeenCalledTimes(1);
    });

    test("should throw AesError for unsupported algorithm", () => {
      const options: KeyUnwrapOptions = {
        publicEncryptionKey: Buffer.from("encrypted-key"),
        keyEncryptionKey: Buffer.from("kek"),
        kryptos: {
          algorithm: "UNKNOWN" as any,
          toJSON: () => ({ algorithm: "UNKNOWN" }),
        } as any,
      };

      expect(() => keyUnwrap(options)).toThrow(AesError);
      expect(() => keyUnwrap(options)).toThrow("Unsupported key wrap algorithm");
      expect(ecbKeyUnwrap).not.toHaveBeenCalled();
      expect(gcmKeyUnwrap).not.toHaveBeenCalled();
    });
  });
});
