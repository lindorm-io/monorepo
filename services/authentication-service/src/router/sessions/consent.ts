import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmConsentSessionController,
  confirmConsentSessionSchema,
  getConsentSessionController,
  getConsentSessionSchema,
  rejectConsentSessionController,
  rejectConsentSessionSchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getConsentSessionSchema),
  useController(getConsentSessionController),
);

router.post(
  "/:id/confirm",
  paramsMiddleware,
  useSchema(confirmConsentSessionSchema),
  useController(confirmConsentSessionController),
);

router.post(
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectConsentSessionSchema),
  useController(rejectConsentSessionController),
);
