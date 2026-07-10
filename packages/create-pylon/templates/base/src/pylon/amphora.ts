import { Amphora } from "@lindorm/amphora";
import { logger } from "../logger/index.js";
import { config } from "./config.js";

// `domain` is this service's issuer: every key added to the vault (the KEK
// below, plus rotated Kryptos keys) derives its issuer + jwks_uri from it, and
// it's what /.well-known/jwks.json publishes under. `environment` rejects any
// key whose certificate was minted for a different deployment environment.
export const amphora = new Amphora({
  logger,
  domain: config.issuer,
  environment: config.nodeEnv,
});

amphora.env(config.pylon.kek);
