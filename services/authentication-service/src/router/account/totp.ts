import { IdentityPermission, Scope } from "../../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { accountEntityMiddleware, identityAuthMiddleware } from "../../middleware";
import { deleteTotpController, deleteTotpSchema, generateTotpController } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/",
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(generateTotpController),
);

router.delete(
  "/",
  useSchema(deleteTotpSchema),
  identityAuthMiddleware({
    permissions: [IdentityPermission.USER],
    scopes: [Scope.OPENID],
  }),
  accountEntityMiddleware("token.bearerToken.subject"),
  useController(deleteTotpController),
);
