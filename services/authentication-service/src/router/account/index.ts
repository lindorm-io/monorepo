import { Scope } from "@lindorm-io/common-enums";
import { Router, useController } from "@lindorm-io/koa";
import {
  generateBrowserLinkCodeController,
  generateRecoveryCodeController,
  getAccountController,
} from "../../controller";
import { accountEntityMiddleware, identityAuthMiddleware } from "../../middleware";

export const router = new Router<any, any>();

router.get(
  "/",
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(getAccountController),
);

router.get(
  "/browser-link-code",
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateBrowserLinkCodeController),
);

router.get(
  "/recovery-code",
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateRecoveryCodeController),
);
