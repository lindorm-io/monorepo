import { Router, useController, useSchema } from "@lindorm-io/koa";
import { tokenExchangeController, tokenExchangeSchema } from "../../controller";
import { clientEntityMiddleware } from "../../middleware";

export const router = new Router<any, any>();

router.post(
  "/",
  useSchema(tokenExchangeSchema),
  clientEntityMiddleware("token.bearerToken.subject"),
  useController(tokenExchangeController),
);
