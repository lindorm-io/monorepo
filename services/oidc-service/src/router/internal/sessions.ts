import { ClientPermission, ClientScope } from "../../common";
import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware, oidcSessionEntityMiddleware } from "../../middleware";
import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  getOidcSessionController,
  getOidcSessionSchema,
  initialiseOidcSessionController,
  initialiseOidcSessionSchema,
} from "../../controller/oidc";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  clientAuthMiddleware({
    permissions: [ClientPermission.OIDC_CONFIDENTIAL],
    scopes: [ClientScope.OIDC_SESSION_WRITE],
  }),
  useSchema(initialiseOidcSessionSchema),
  useController(initialiseOidcSessionController),
);

router.get(
  "/:id",
  paramsMiddleware,
  clientAuthMiddleware({
    permissions: [ClientPermission.OIDC_CONFIDENTIAL],
    scopes: [ClientScope.OIDC_SESSION_READ],
  }),
  useSchema(getOidcSessionSchema),
  oidcSessionEntityMiddleware("data.id"),
  useController(getOidcSessionController),
);
