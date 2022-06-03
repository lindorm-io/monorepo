import { TokenIssuer } from "@lindorm-io/jwt";
import { getTestKeystore } from "./test-keystore";
import { createMockLogger } from "@lindorm-io/winston";

export const getTestJwt = (): TokenIssuer =>
  new TokenIssuer({
    issuer: "issuer",
    keystore: getTestKeystore(),
    logger: createMockLogger(),
  });
