import { getPendingRdcSessionsController, getPendingRdcSessionsSchema } from "../controller";
import { identityAuthMiddleware } from "../middleware";
import { paramsMiddleware, Router, useAssertion, useController, useSchema } from "@lindorm-io/koa";

const router = new Router<any, any>();
export default router;

router.use(identityAuthMiddleware());

router.get(
  "/:id/rdc/pending",
  paramsMiddleware,
  useSchema(getPendingRdcSessionsSchema),
  useAssertion({
    fromPath: {
      expect: "data.id",
      actual: "token.bearerToken.subject",
    },
  }),
  useController(getPendingRdcSessionsController),
);
