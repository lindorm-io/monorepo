import { ClientPermission, ClientScope } from "../../common";
import { Context } from "../../types";
import { Router, useController, useSchema } from "@lindorm-io/koa";
import { clientAuthMiddleware } from "../../middleware";
import {
  sendEmailController,
  sendEmailSchema,
  sendSmsController,
  sendSmsSchema,
} from "../../controller";

const router = new Router<unknown, Context>();
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
