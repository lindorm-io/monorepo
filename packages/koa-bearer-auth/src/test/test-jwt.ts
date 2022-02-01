import { TokenIssuer } from "@lindorm-io/jwt";
import { getTestKeystore } from "./test-keystore";
import { logger } from "./test-logger";

export const getTestJwt = (): TokenIssuer =>
  new TokenIssuer({
    issuer: "issuer",
    keystore: getTestKeystore(),
    logger,
  });
