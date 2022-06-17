import { ServerKoaContext } from "../../types";
import { ClientPermission } from "../../common";
import { clientAuthMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authenticateIdentifierController, authenticateIdentifierSchema } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
  }),
);

router.post(
  "/",
  paramsMiddleware,
  useSchema(authenticateIdentifierSchema),
  useController(authenticateIdentifierController),
);
