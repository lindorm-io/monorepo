import { IdentityPermission } from "../../common";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { identityAdminController, identityAdminSchema } from "../../controller";
import { identityAuthMiddleware, identityEntityMiddleware } from "../../middleware";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.patch(
  "/:id",
  paramsMiddleware,
  identityAuthMiddleware({
    permissions: [IdentityPermission.IDENTITY_ADMIN],
  }),
  useSchema(identityAdminSchema),
  identityEntityMiddleware("data.id"),
  useController(identityAdminController),
);
