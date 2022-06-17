import { ClientPermission } from "../../common";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import { getIdentitySessionsController, getIdentitySessionsSchema } from "../../controller";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.OAUTH_CONFIDENTIAL],
  }),
);

router.get(
  "/:id/sessions",
  paramsMiddleware,
  useSchema(getIdentitySessionsSchema),
  useController(getIdentitySessionsController),
);
