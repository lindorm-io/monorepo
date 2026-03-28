const ENCRYPTED_PREFIX = "mock-encrypted:";

export const createMockAesModule = () => ({
  AesKit: jest.fn().mockImplementation(() => ({
    encrypt: jest.fn((data: string, _mode: string) => `${ENCRYPTED_PREFIX}${data}`),
    decrypt: jest.fn((token: string) => {
      if (!token.startsWith(ENCRYPTED_PREFIX)) {
        throw new Error("Cannot decrypt: invalid token");
      }
      return token.slice(ENCRYPTED_PREFIX.length);
    }),
  })),
});
