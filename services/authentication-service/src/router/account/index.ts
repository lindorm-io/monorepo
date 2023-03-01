import { Router, useController } from "@lindorm-io/koa";
import { accountEntityMiddleware, identityAuthMiddleware } from "../../middleware";
import {
  generateBrowserLinkCodeController,
  generateRecoveryCodeController,
  getAccountController,
} from "../../controller";
import { OpenIdScope } from "@lindorm-io/common-types";

const router = new Router<any, any>();
export default router;

router.get(
  "/",
  identityAuthMiddleware({
    scopes: [OpenIdScope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(getAccountController),
);

router.get(
  "/browser-link-code",
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
    scopes: [OpenIdScope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateBrowserLinkCodeController),
);

router.get(
  "/recovery-code",
  identityAuthMiddleware({
    scopes: [OpenIdScope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateRecoveryCodeController),
);
