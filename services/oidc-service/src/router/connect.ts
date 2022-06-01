import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { IdentityPermission, Scope } from "../common";
import { ServerKoaContext } from "../types";
import { identityAuthMiddleware } from "../middleware";
import { useController, useSchema } from "@lindorm-io/koa";
import {
  connectOidcToIdentityController,
  connectOidcToIdentitySchema,
} from "../controller/oidc/connect-oidc-to-identity";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(connectOidcToIdentitySchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  useController(connectOidcToIdentityController),
);
