import { ClientPermission } from "../../common";
import { Router, useController } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import { getPrivateJwksController } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.VAULT_CONFIDENTIAL],
  }),
);

router.get("/", useController(getPrivateJwksController));
