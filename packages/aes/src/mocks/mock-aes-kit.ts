import { createMockKryptos } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { IAesKit } from "../interfaces";

export const createMockAesKit = (): IAesKit => ({
  kryptos: createMockKryptos(),

  decrypt: jest
    .fn()
    .mockImplementation((data: Dict | string, _options?: any) =>
      Buffer.from(JSON.stringify(data), "base64").toString(),
    ),
  encrypt: jest
    .fn()
    .mockImplementation((data: string, mode: any, _options?: any) =>
      mode === "encoded"
        ? Buffer.from(data).toString("base64")
        : { content: Buffer.from(data).toString("base64") },
    ),
  assert: jest.fn(),
  verify: jest.fn().mockReturnValue(true),
  prepareEncryption: jest.fn().mockReturnValue({
    headerParams: {},
    publicEncryptionKey: undefined,
    encrypt: jest.fn().mockReturnValue({
      authTag: Buffer.alloc(16),
      content: Buffer.alloc(0),
      contentType: "text/plain",
      initialisationVector: Buffer.alloc(12),
    }),
  }),
});
