import { Context } from "../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { consentSessionCookieMiddleware } from "../../middleware";
import {
  confirmConsentController,
  confirmConsentSchema,
  getConsentInfoController,
  rejectConsentController,
} from "../../controller";

const router = new Router<unknown, Context>();
export default router;

router.get("/", consentSessionCookieMiddleware, useController(getConsentInfoController));

router.put(
  "/confirm",
  useSchema(confirmConsentSchema),
  consentSessionCookieMiddleware,
  useController(confirmConsentController),
);

router.put("/reject", consentSessionCookieMiddleware, useController(rejectConsentController));
