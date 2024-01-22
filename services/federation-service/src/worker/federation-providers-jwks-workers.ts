import { IntervalWorker } from "@lindorm-io/koa";
import { storedKeySetJwksRedisWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";
import { configuration } from "../server/configuration";
import { logger } from "../server/logger";

export const federationProvidersJwksWorkers: Array<IntervalWorker> = [];

for (const provider of configuration.federation_providers) {
  if (provider.response_type !== "id_token") continue;

  federationProvidersJwksWorkers.push(
    storedKeySetJwksRedisWorker({
      alias: provider.key,
      host: provider.base_url,
      logger,
      redisConnection,
    }),
  );
}
