import { Context } from "../../types";
import { ClientPermission, ClientScope } from "../../common";
import { clientAuthMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { authenticateIdentifierController, authenticateIdentifierSchema } from "../../controller";

const router = new Router<unknown, Context>();
export default router;

router.post(
  "/authenticate",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.IDENTITY_CONFIDENTIAL],
    scopes: [ClientScope.IDENTIFIER_READ, ClientScope.IDENTIFIER_WRITE],
  }),
  useSchema(authenticateIdentifierSchema),
  useController(authenticateIdentifierController),
);
