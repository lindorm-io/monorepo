import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  connectFederationToIdentityController,
  connectFederationToIdentitySchema,
} from "../controller";
import { identityAuthMiddleware } from "../middleware";
import { configuration } from "../server/configuration";

export const router = new Router<any, any>();

router.use(identityAuthMiddleware());

router.get(
  "/",
  redirectErrorMiddleware({
    redirectUri: configuration.frontend.routes.error,
    path: "data.callbackUri",
  }),
  useSchema(connectFederationToIdentitySchema),
  useController(connectFederationToIdentityController),
);
