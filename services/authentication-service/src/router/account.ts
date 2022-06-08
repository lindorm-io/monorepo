import { IdentityPermission, Scope } from "../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { accountEntityMiddleware, identityAuthMiddleware } from "../middleware";
import {
  createAccountPasswordController,
  createAccountPasswordSchema,
  deleteAccountTotpController,
  deleteAccountTotpSchema,
  generateAccountRecoveryCodeController,
  generateAccountTotpController,
  getAccountController,
  updateAccountPasswordController,
  updateAccountPasswordSchema,
} from "../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(getAccountController),
);

router.post(
  "/password",
  useSchema(createAccountPasswordSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(createAccountPasswordController),
);

router.patch(
  "/password",
  useSchema(updateAccountPasswordSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(updateAccountPasswordController),
);

router.get(
  "/recovery-code",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateAccountRecoveryCodeController),
);

router.get(
  "/totp",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateAccountTotpController),
);

router.delete(
  "/totp",
  useSchema(deleteAccountTotpSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(deleteAccountTotpController),
);
