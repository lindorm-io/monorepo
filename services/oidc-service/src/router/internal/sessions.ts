import { ClientPermission } from "../../common";
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

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.OIDC_CONFIDENTIAL],
  }),
);

router.post(
  "/",
  useSchema(initialiseOidcSessionSchema),
  useController(initialiseOidcSessionController),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getOidcSessionSchema),
  oidcSessionEntityMiddleware("data.id"),
  useController(getOidcSessionController),
);
