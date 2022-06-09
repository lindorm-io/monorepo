import { JWT } from "../class";
import { JwtOptions } from "../types";
import { createTestKeystore } from "@lindorm-io/key-pair";
import { createMockLogger } from "@lindorm-io/winston";

export const createTestJwt = (options: Partial<JwtOptions> = {}): JWT =>
  new JWT({
    issuer: "issuer",
    keystore: createTestKeystore(),
    logger: createMockLogger(),
    ...options,
  });
