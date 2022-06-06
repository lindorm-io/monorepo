import { ServerKoaContext } from "../../types";
import { ClientPermission, ClientScope } from "../../common";
import { clientAuthMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authenticateIdentifierController, authenticateIdentifierSchema } from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  paramsMiddleware,
  useSchema(authenticateIdentifierSchema),
  clientAuthMiddleware({
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
    scopes: [ClientScope.IDENTITY_IDENTIFIER_READ, ClientScope.IDENTITY_IDENTIFIER_WRITE],
  }),
  useController(authenticateIdentifierController),
);
