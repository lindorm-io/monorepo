import { IntervalWorker } from "@lindorm-io/koa";
import { keyPairJwksMemoryWorker } from "@lindorm-io/koa-keystore";
import { memoryDatabase } from "../instance";
import { configuration } from "../server/configuration";
import { logger } from "../server/logger";

export const oidcProvidersJwksWorkers: Array<IntervalWorker> = [];

for (const provider of configuration.oidc_providers) {
  if (provider.response_type !== "id_token") continue;

  oidcProvidersJwksWorkers.push(
    keyPairJwksMemoryWorker({
      alias: provider.key,
      host: provider.base_url,
      logger,
      memoryDatabase,
    }),
  );
}
