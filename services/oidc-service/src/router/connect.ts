import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { configuration } from "../server/configuration";
import { connectOidcToIdentityController, connectOidcToIdentitySchema } from "../controller";
import { identityAuthMiddleware } from "../middleware";

export const router = new Router<any, any>();

router.use(identityAuthMiddleware());

router.get(
  "/",
  redirectErrorMiddleware({
    redirectUri: configuration.frontend.routes.error,
    path: "data.callbackUri",
  }),
  useSchema(connectOidcToIdentitySchema),
  useController(connectOidcToIdentityController),
);
