import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import {
  sendCodeController,
  sendCodeSchema,
  sendOtpController,
  sendOtpSchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.post("/code", useSchema(sendCodeSchema), useController(sendCodeController));

router.post("/otp", useSchema(sendOtpSchema), useController(sendOtpController));
