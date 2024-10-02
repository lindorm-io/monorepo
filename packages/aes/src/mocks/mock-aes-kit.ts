import { createMockKryptos } from "@lindorm/kryptos";
import { Dict } from "@lindorm/types";
import { IAesKit } from "../interfaces";

export const createMockAesKit = (): IAesKit => ({
  kryptos: createMockKryptos(),

  decrypt: jest
    .fn()
    .mockImplementation((data: Dict | string) =>
      Buffer.from(JSON.stringify(data), "base64").toString(),
    ),
  encrypt: jest
    .fn()
    .mockImplementation((data: string, mode: any) =>
      mode === "cipher"
        ? Buffer.from(data).toString("base64")
        : { content: Buffer.from(data).toString("base64") },
    ),
  assert: jest.fn(),
  verify: jest.fn().mockReturnValue(true),
});
