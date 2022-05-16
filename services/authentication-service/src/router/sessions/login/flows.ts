import { Router, useAssertion, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../../types";
import { includes } from "lodash";
import {
  flowSessionEntityMiddleware,
  flowTokenMiddleware,
  loginSessionCookieMiddleware,
  loginSessionEntityMiddleware,
} from "../../../middleware";
import {
  confirmFlowController,
  confirmFlowSchema,
  getFlowStatusController,
  getFlowStatusSchema,
  initialiseFlowController,
  initialiseFlowSchema,
  rejectFlowController,
  rejectFlowSchema,
} from "../../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(initialiseFlowSchema),
  loginSessionCookieMiddleware,
  useAssertion({
    assertion: includes,
    fromPath: {
      expect: "entity.loginSession.allowedFlows",
      actual: "data.flowType",
    },
    hint: "flowType",
  }),
  useController(initialiseFlowController),
);

router.put(
  "/:id/confirm",
  useSchema(confirmFlowSchema),
  flowTokenMiddleware("data.flowToken"),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.flowToken.sessionId",
    },
  }),
  flowSessionEntityMiddleware("data.id"),
  loginSessionEntityMiddleware("entity.flowSession.loginSessionId"),
  useController(confirmFlowController),
);

router.put(
  "/:id/reject",
  useSchema(rejectFlowSchema),
  flowTokenMiddleware("data.flowToken"),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.flowToken.sessionId",
    },
  }),
  flowSessionEntityMiddleware("data.id"),
  loginSessionEntityMiddleware("entity.flowSession.loginSessionId"),
  useController(rejectFlowController),
);

router.get(
  "/:id/status",
  useSchema(getFlowStatusSchema),
  flowSessionEntityMiddleware("data.id"),
  useController(getFlowStatusController),
);
