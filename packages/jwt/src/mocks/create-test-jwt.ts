import { createMockLogger, Logger } from "@lindorm-io/core-logger";
import { createTestKeystore, Keystore } from "@lindorm-io/keystore";
import { JWT } from "../class";
import { JwtOptions } from "../types";

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
