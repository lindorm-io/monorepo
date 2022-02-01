import { TokenIssuer } from "@lindorm-io/jwt";
import { configuration } from "../../configuration";
import { getTestKeystore } from "./test-keystore";
import { logger } from "../logger";

export const getTestJwt = (): TokenIssuer =>
  new TokenIssuer({
    issuer: configuration.oauth.host,
    keystore: getTestKeystore(),
    logger,
  });
