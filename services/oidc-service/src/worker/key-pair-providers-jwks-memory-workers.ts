import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "../server/configuration";
import { keyPairJwksMemoryWorker } from "@lindorm-io/koa-keystore";
import { logger } from "../server/logger";
import { memoryDatabase } from "../instance";

export const oidcProvidersJwksWorkers: Array<IntervalWorker> = [];

for (const provider of configuration.oidc_providers) {
  if (provider.response_type !== "id_token") continue;

  oidcProvidersJwksWorkers.push(
    keyPairJwksMemoryWorker({
      clientName: provider.key,
      host: provider.base_url,
      logger,
      memoryDatabase,
    }),
  );
}
