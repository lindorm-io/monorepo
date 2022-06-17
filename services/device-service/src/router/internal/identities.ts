import { ServerKoaContext } from "../../types";
import { ClientPermission } from "../../common";
import { clientAuthMiddleware } from "../../middleware";
import { useController, paramsMiddleware, Router, useSchema } from "@lindorm-io/koa";
import { getIdentityDeviceLinksController, getIdentityDeviceLinksSchema } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
  }),
);

router.get(
  "/:id/deviceLinks",
  paramsMiddleware,
  useSchema(getIdentityDeviceLinksSchema),
  useController(getIdentityDeviceLinksController),
);
