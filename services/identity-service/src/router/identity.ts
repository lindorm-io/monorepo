import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { IdentityPermission, Scope } from "../common";
import { ServerKoaContext } from "../types";
import { identityAuthMiddleware, identityEntityMiddleware } from "../middleware";
import { useController, useSchema } from "@lindorm-io/koa";
import {
  getIdentityController,
  updateIdentityController,
  updateIdentitySchema,
} from "../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(getIdentityController),
);

router.patch(
  "/",
  useSchema(updateIdentitySchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(updateIdentityController),
);
