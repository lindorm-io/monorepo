import { ServerKoaContext } from "../../types";
import { ClientPermission, ClientScope } from "../../common";
import { clientAuthMiddleware } from "../../middleware";
import { useController, paramsMiddleware, Router, useSchema } from "@lindorm-io/koa";
import { getIdentityDeviceLinksController, getIdentityDeviceLinksSchema } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/:id/deviceLinks",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
    scopes: [ClientScope.DEVICE_IDENTITY_READ],
  }),

  useSchema(getIdentityDeviceLinksSchema),
  useController(getIdentityDeviceLinksController),
);
