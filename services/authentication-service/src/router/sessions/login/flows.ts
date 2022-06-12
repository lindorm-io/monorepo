import { paramsMiddleware, Router, useAssertion, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../../types";
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
  useController(initialiseFlowController),
);

router.put(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmFlowSchema),
  flowTokenMiddleware("data.flowToken"),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.flowToken.sessionId",
    },
    hint: "id",
  }),
  flowSessionEntityMiddleware("data.id"),
  loginSessionEntityMiddleware("entity.flowSession.loginSessionId"),
  useController(confirmFlowController),
);

router.put(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectFlowSchema),
  flowTokenMiddleware("data.flowToken"),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.flowToken.sessionId",
    },
    hint: "id",
  }),
  flowSessionEntityMiddleware("data.id"),
  loginSessionEntityMiddleware("entity.flowSession.loginSessionId"),
  useController(rejectFlowController),
);

router.get(
  "/:id/status",
  paramsMiddleware,
  useSchema(getFlowStatusSchema),
  flowSessionEntityMiddleware("data.id"),
  useController(getFlowStatusController),
);
