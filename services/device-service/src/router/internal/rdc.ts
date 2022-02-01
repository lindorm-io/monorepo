import { ClientPermission, ClientScope } from "../../common";
import { Context } from "../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import { initialiseRdcController, initialiseRdcSchema } from "../../controller";

const router = new Router<unknown, Context>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.DEVICE_CONFIDENTIAL],
    scopes: [ClientScope.DEVICE_RDC_WRITE],
  }),
);

router.post("/", useSchema(initialiseRdcSchema), useController(initialiseRdcController));
