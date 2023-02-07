import { LindormScopes } from "@lindorm-io/common-types";
import { identityAuthMiddleware, identityEntityMiddleware } from "../../middleware";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { updateIdentityController, updateIdentitySchema } from "../../controller";

const router = new Router();
export default router;

router.patch(
  "/",
  useSchema(updateIdentitySchema),
  identityAuthMiddleware({ scopes: [LindormScopes.OPENID] }),
  identityEntityMiddleware("token.bearerToken.subject"),
  useController(updateIdentityController),
);
