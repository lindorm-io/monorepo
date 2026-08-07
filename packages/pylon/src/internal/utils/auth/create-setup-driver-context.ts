import { Aegis } from "@lindorm/aegis";
import type { IAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import type { ILogger } from "@lindorm/logger";
import type { Environment } from "@lindorm/types";
import type { PylonAuthDriverContext } from "../../../types/index.js";

type Options = {
  amphora: IAmphora;
  environment: Environment;
  logger: ILogger;
};

/**
 * The driver context used ONCE at setup, to ask the configured driver for its
 * `endpoints()` while building `ctx.state.app.config.auth`. There is no request
 * at that point, so there is nothing to correlate and no request-scoped session
 * to hand over.
 *
 * ⚠ Only viable because `endpoints()` is SYNCHRONOUS and amphora has already
 * fetched: a driver projects what the vault holds, so the amphora on this
 * context is the whole answer. The remaining members are on the contract and so
 * must be real — `aegis` is a wrapper over that same vault, and `conduit`
 * constructs nothing on the wire — but a driver reaching for either from
 * `endpoints()` is doing amphora's work in the wrong place.
 *
 * `kv` is `undefined` rather than the source's own session: a driver context
 * carries the REQUEST's session, and at setup there is no request whose actor
 * and correlation id a write should inherit.
 */
export const createSetupDriverContext = (options: Options): PylonAuthDriverContext => ({
  aegis: new Aegis({ amphora: options.amphora, logger: options.logger }),
  amphora: options.amphora,
  conduit: new Conduit({
    alias: "auth",
    environment: options.environment,
    logger: options.logger,
  }),
  environment: options.environment,
  kv: undefined,
  logger: options.logger,
});
