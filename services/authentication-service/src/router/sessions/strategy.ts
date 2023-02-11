import { paramsMiddleware, Router, useAssertion, useController, useSchema } from "@lindorm-io/koa";
import {
  authenticationSessionEntityMiddleware,
  strategySessionEntityMiddleware,
  strategySessionTokenMiddleware,
} from "../../middleware";
import {
  confirmStrategyController,
  confirmStrategySchema,
  getStrategyInfoController,
  getStrategyInfoSchema,
  rejectStrategyController,
  rejectStrategySchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getStrategyInfoSchema),
  strategySessionEntityMiddleware("data.id"),
  useController(getStrategyInfoController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmStrategySchema),
  strategySessionTokenMiddleware("data.strategySessionToken"),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.strategySessionToken.subject",
    },
    hint: "id",
  }),
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
