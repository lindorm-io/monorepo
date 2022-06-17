import { ClientPermission } from "../../common";
import { ServerKoaContext } from "../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import { initialiseRdcController, initialiseRdcSchema } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.DEVICE_CONFIDENTIAL],
  }),
);

router.post("/", useSchema(initialiseRdcSchema), useController(initialiseRdcController));
