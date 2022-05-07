import { ClientPermission, ClientScope } from "../../common";
import { Context } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { getIdentitySessionsController, getIdentitySessionsSchema } from "../../controller";

const router = new Router<unknown, Context>();
export default router;

router.get(
  "/:id/sessions",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
    scopes: [ClientScope.OAUTH_IDENTITY_READ],
  }),
  useSchema(getIdentitySessionsSchema),
  useController(getIdentitySessionsController),
);
