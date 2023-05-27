import { Router, useController, useSchema } from "@lindorm-io/koa";
import { revokeTokenController, revokeTokenSchema } from "../../../controller";
import { authenticateClientMiddleware } from "../../../middleware";

export const router = new Router<any, any>();

router.use(authenticateClientMiddleware);

router.post("/", useSchema(revokeTokenSchema), useController(revokeTokenController));
