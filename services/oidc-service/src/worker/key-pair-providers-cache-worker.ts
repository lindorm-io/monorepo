import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "../server/configuration";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";
import { logger } from "../server/logger";

export const oidcProvidersJwksWorkers: Array<IntervalWorker> = [];

for (const provider of configuration.oidc_providers) {
  if (provider.response_type !== "id_token") continue;

  oidcProvidersJwksWorkers.push(
    keyPairJwksCacheWorker({
      clientName: provider.key,
      host: provider.base_url,
      logger,
      redisConnection,
    }),
  );
}
