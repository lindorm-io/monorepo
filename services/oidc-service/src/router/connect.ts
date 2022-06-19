import { IdentityPermission, Scope } from "../common";
import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { ServerKoaContext } from "../types";
import { configuration } from "../server/configuration";
import { identityAuthMiddleware } from "../middleware";
import { redirectErrorMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  connectOidcToIdentityController,
  connectOidcToIdentitySchema,
} from "../controller/oidc/connect-oidc-to-identity";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  redirectErrorMiddleware({
    redirectUri: configuration.frontend.routes.error,
    path: "data.callbackUri",
  }),
  useSchema(connectOidcToIdentitySchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  useController(connectOidcToIdentityController),
);
