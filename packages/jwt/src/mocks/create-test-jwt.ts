import { JWT } from "../class";
import { JwtOptions } from "../types";
import { createTestKeystore, Keystore } from "@lindorm-io/key-pair";
import { createMockLogger, Logger } from "@lindorm-io/core-logger";

export const createTestJwt = (
  options: Partial<JwtOptions> = {},
  keystore?: Keystore,
  logger?: Logger,
): JWT =>
  new JWT(
    {
      issuer: "https://test.lindorm.io",
      ...options,
    },
    keystore || createTestKeystore(),
    logger || createMockLogger(),
  );
