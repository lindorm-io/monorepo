import { Router, useController, useSchema } from "@lindorm-io/koa";
import { tokenExchangeController, tokenExchangeSchema } from "../../controller";

export const router = new Router<any, any>();

router.post("/", useSchema(tokenExchangeSchema), useController(tokenExchangeController));
