import { getPendingRdcSessionsController, getPendingRdcSessionsSchema } from "../controller";
import { identityAuthMiddleware } from "../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

export const router = new Router<any, any>();

router.use(identityAuthMiddleware());

router.get(
  "/:id/rdc/pending",
  paramsMiddleware,
  useSchema(getPendingRdcSessionsSchema),
  useController(getPendingRdcSessionsController),
);
