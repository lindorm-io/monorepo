import { Router, useController, useSchema } from "@lindorm-io/koa";
import {
  oauthBackchannelController,
  oauthBackchannelSchema,
} from "../../controller/oauth/backchannel";
import { authenticateClientMiddleware, idTokenMiddleware } from "../../middleware";

export const router = new Router<any, any>();

router.post(
  "/",
  useSchema(oauthBackchannelSchema),
  authenticateClientMiddleware,
  idTokenMiddleware("data.idTokenHint", { optional: true }),
  useController(oauthBackchannelController),
);
