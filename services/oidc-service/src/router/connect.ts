import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { configuration } from "../server/configuration";
import { identityAuthMiddleware } from "../middleware";
import { redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { LindormScopes } from "@lindorm-io/common-types";
import { connectOidcToIdentityController, connectOidcToIdentitySchema } from "../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/",
  redirectErrorMiddleware({
    redirectUri: configuration.frontend.routes.error,
    path: "data.callbackUri",
  }),
  useSchema(connectOidcToIdentitySchema),
  identityAuthMiddleware({
    scopes: [LindormScopes.OPENID],
  }),
  useController(connectOidcToIdentityController),
);
