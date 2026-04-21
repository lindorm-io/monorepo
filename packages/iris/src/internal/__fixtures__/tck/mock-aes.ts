import { vi } from "vitest";
const ENCRYPTED_PREFIX = "mock-encrypted:";

export const createMockAesModule = () => ({
  AesKit: vi.fn(function () {
    return {
      encrypt: vi.fn((data: string, _mode: string) => `${ENCRYPTED_PREFIX}${data}`),
      decrypt: vi.fn((token: string) => {
        if (!token.startsWith(ENCRYPTED_PREFIX)) {
          throw new Error("Cannot decrypt: invalid token");
        }
        return token.slice(ENCRYPTED_PREFIX.length);
      }),
    };
  }),
  parseAes: vi.fn((_data: string) => ({ keyId: "mock-kryptos-key" })),
});
