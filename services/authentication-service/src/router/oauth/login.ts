import { ERROR_REDIRECT_URI } from "../../constant";
import { redirectLoginSessionController, redirectLoginSessionSchema } from "../../controller";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

export const router = new Router<any, any>();

router.get(
  "/",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(redirectLoginSessionSchema),
  useController(redirectLoginSessionController),
);
