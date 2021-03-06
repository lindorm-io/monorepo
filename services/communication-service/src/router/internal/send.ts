import { ClientPermission } from "../../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import {
  sendCodeController,
  sendCodeSchema,
  sendOtpController,
  sendOtpSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.use(
  clientAuthMiddleware({
    permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
  }),
);

router.get("/code", useSchema(sendCodeSchema), useController(sendCodeController));

router.get("/otp", useSchema(sendOtpSchema), useController(sendOtpController));
