import { IntervalWorker } from "@lindorm-io/koa";
import { configuration } from "../server/configuration";
import { keyPairJwksCacheWorker } from "@lindorm-io/koa-keystore";
import { redisConnection } from "../instance";
import { winston } from "../server/logger";

export const oidcProvidersJwksWorkers: Array<IntervalWorker> = [];

for (const provider of configuration.oidc_providers) {
  if (provider.response_type !== "id_token") continue;

  oidcProvidersJwksWorkers.push(
    keyPairJwksCacheWorker({
      host: provider.base_url,
      clientName: provider.key,
      redisConnection,
      winston,
    }),
  );
}

export const keyPairOAuthJwksWorker = keyPairJwksCacheWorker({
  host: configuration.services.oauth_service.host,
  port: configuration.services.oauth_service.port,
  clientName: "oauthClient",
  redisConnection,
  retry: 30,
  winston,
});
