import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  confirmConsentSessionController,
  confirmConsentSessionSchema,
  getConsentSessionDataController,
  getConsentSessionDataSchema,
  rejectConsentSessionController,
  rejectConsentSessionSchema,
} from "../../controller";

const router = new Router();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getConsentSessionDataSchema),
  useController(getConsentSessionDataController),
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
