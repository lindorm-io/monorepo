import { ERROR_REDIRECT_URI } from "../../constant";
import { redirectSelectAccountController, redirectSelectAccountSchema } from "../../controller";
import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

export const router = new Router<any, any>();

router.get(
  "/",
  redirectErrorMiddleware({ redirectUri: ERROR_REDIRECT_URI }),
  useSchema(redirectSelectAccountSchema),
  useController(redirectSelectAccountController),
);
