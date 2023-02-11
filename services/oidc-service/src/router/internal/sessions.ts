import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { clientAuthMiddleware, oidcSessionEntityMiddleware } from "../../middleware";
import { paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  getOidcSessionController,
  getOidcSessionSchema,
  initialiseOidcSessionController,
  initialiseOidcSessionSchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
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
