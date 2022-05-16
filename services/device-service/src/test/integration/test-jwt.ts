import { TokenIssuer } from "@lindorm-io/jwt";
import { configuration } from "../../server/configuration";
import { getTestKeystore } from "./test-keystore";
import { logger } from "../logger";

export const getTestJwt = (): TokenIssuer =>
  new TokenIssuer({
    issuer:
      configuration.services.oauth_service.issuer || configuration.services.oauth_service.host,
    keystore: getTestKeystore(),
    logger,
  });

export const getTestDeviceLinkJwt = (): TokenIssuer =>
  new TokenIssuer({
    issuer: configuration.server.issuer || configuration.server.host,
    keystore: getTestKeystore(),
    logger,
  });
