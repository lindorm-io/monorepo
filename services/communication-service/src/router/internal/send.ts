import { ClientPermission, ClientScope } from "../../common";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { ServerKoaContext } from "../../types";
import { clientAuthMiddleware } from "../../middleware";
import {
  sendEmailController,
  sendEmailSchema,
  sendSmsController,
  sendSmsSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/email",
  clientAuthMiddleware({
    permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
    scopes: [ClientScope.COMMUNICATION_MESSAGE_SEND],
  }),
  useSchema(sendEmailSchema),
  useController(sendEmailController),
);

router.get(
  "/sms",
  clientAuthMiddleware({
    permissions: [ClientPermission.COMMUNICATION_CONFIDENTIAL],
    scopes: [ClientScope.COMMUNICATION_MESSAGE_SEND],
  }),
  useSchema(sendSmsSchema),
  useController(sendSmsController),
);
