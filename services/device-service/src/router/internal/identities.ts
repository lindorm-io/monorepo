import { clientAuthMiddleware } from "../../middleware";
import { useController, paramsMiddleware, Router, useSchema } from "@lindorm-io/koa";
import { getIdentityDeviceLinksController, getIdentityDeviceLinksSchema } from "../../controller";

const router = new Router();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.get(
  "/:id/device-links",
  paramsMiddleware,
  useSchema(getIdentityDeviceLinksSchema),
  useController(getIdentityDeviceLinksController),
);
