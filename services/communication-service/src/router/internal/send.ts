import { ClientPermission, ClientScope } from "../../common";
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

router.get(
  "/code",
  useSchema(sendCodeSchema),
  clientAuthMiddleware({
    permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
    scopes: [ClientScope.COMMUNICATION_MESSAGE_SEND],
  }),
  useController(sendCodeController),
);

router.get(
  "/otp",
  useSchema(sendOtpSchema),
  clientAuthMiddleware({
    permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
    scopes: [ClientScope.COMMUNICATION_MESSAGE_SEND],
  }),
  useController(sendOtpController),
);
