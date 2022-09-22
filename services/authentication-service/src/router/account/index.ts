import { IdentityPermission, Scope } from "../../common";
import { Router, useController } from "@lindorm-io/koa";
import { accountEntityMiddleware, identityAuthMiddleware } from "../../middleware";
import {
  generateBrowserLinkCodeController,
  generateRecoveryCodeController,
  getAccountController,
} from "../../controller";

const router = new Router();
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

router.get(
  "/browser-link-code",
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateBrowserLinkCodeController),
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
