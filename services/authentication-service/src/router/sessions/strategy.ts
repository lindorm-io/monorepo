import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authenticationSessionEntityMiddleware,
  strategySessionEntityMiddleware,
  strategySessionTokenMiddleware,
} from "../../middleware";
import {
  confirmStrategyController,
  confirmStrategySchema,
  getStrategyController,
  getStrategySchema,
  rejectStrategyController,
  rejectStrategySchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getStrategySchema),
  strategySessionEntityMiddleware("data.id"),
  useController(getStrategyController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmStrategySchema),
  strategySessionTokenMiddleware("data.strategySessionToken"),
  strategySessionEntityMiddleware("data.id"),
  authenticationSessionEntityMiddleware("entity.strategySession.authenticationSessionId"),
  useController(confirmStrategyController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectStrategySchema),
  strategySessionEntityMiddleware("data.id"),
  useController(rejectStrategyController),
);
