import { TokenIssuer } from "../class";
import { IssuerOptions } from "../types";
import { createTestKeystore } from "@lindorm-io/key-pair";
import { createMockLogger } from "@lindorm-io/winston";

export const createTestJwt = (options: Partial<IssuerOptions> = {}): TokenIssuer =>
  new TokenIssuer({
    issuer: "issuer",
    keystore: createTestKeystore(),
    logger: createMockLogger(),
    ...options,
  });
