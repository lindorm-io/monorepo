import { IdentityPermission, Scope } from "../../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { accountEntityMiddleware, identityAuthMiddleware } from "../../middleware";
import {
  createPasswordController,
  createPasswordSchema,
  updateAccountPasswordController,
  updateAccountPasswordSchema,
} from "../../controller";

const router = new Router();
export default router;

router.post(
  "/",
  useSchema(createPasswordSchema),
  identityAuthMiddleware({
    adjustedAccessLevel: 2,
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(createPasswordController),
);

router.patch(
  "/",
  useSchema(updateAccountPasswordSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(updateAccountPasswordController),
);
