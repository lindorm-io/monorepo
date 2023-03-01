import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  authenticationSessionEntityMiddleware,
  identityAuthMiddleware,
  strategySessionEntityMiddleware,
  strategySessionTokenMiddleware,
} from "../../middleware";
import {
  acknowledgeStrategyController,
  acknowledgeStrategySchema,
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

router.get(
  "/:id/acknowledge",
  paramsMiddleware,
  identityAuthMiddleware(),
  useSchema(acknowledgeStrategySchema),
  strategySessionEntityMiddleware("data.id"),
  useController(acknowledgeStrategyController),
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
