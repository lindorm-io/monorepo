import { Router, useController } from "@lindorm-io/koa";
import { accountEntityMiddleware, identityAuthMiddleware } from "../../middleware";
import { LindormScopes } from "@lindorm-io/common-types";
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
    scopes: [LindormScopes.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(getAccountController),
);

router.get(
  "/browser-link-code",
  identityAuthMiddleware({
    adjustedAccessLevel: 3,
    scopes: [LindormScopes.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateBrowserLinkCodeController),
);

router.get(
  "/recovery-code",
  identityAuthMiddleware({
    scopes: [LindormScopes.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateRecoveryCodeController),
);
