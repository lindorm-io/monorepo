import { Router, useController, useSchema } from "@lindorm-io/koa";
import { tokenIntrospectController, tokenIntrospectSchema } from "../controller";
import { assertClientMiddleware } from "../middleware";

export const router = new Router<any, any>();

router.use(assertClientMiddleware);

router.post("/", useSchema(tokenIntrospectSchema), useController(tokenIntrospectController));
