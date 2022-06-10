import { IdentityPermission, Scope } from "../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../types";
import { accountEntityMiddleware, identityAuthMiddleware } from "../middleware";
import {
  createAccountPasswordController,
  createAccountPasswordSchema,
  deleteAccountTotpController,
  deleteAccountTotpSchema,
  generateRecoveryCodeController,
  generateTotpController,
  generateBrowserLinkCodeController,
  getAccountController,
  linkAccountToBrowserController,
  linkAccountToBrowserSchema,
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
  "/browser-code",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateBrowserLinkCodeController),
);

router.post(
  "/browser-link",
  useSchema(linkAccountToBrowserSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(linkAccountToBrowserController),
);

router.get(
  "/recovery-code",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateRecoveryCodeController),
);

router.get(
  "/totp",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateTotpController),
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
