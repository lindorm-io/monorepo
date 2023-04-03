import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { oidcSessionCallbackController, oidcSessionCallbackSchema } from "../controller";
import { oidcSessionEntityMiddleware } from "../middleware";
import { configuration } from "../server/configuration";

export const router = new Router<any, any>();

router.get(
  "/",
  redirectErrorMiddleware({
    redirectUri: configuration.frontend.routes.error,
  }),
  useSchema(oidcSessionCallbackSchema),
  oidcSessionEntityMiddleware("data.state", { attributeKey: "state" }),
  useController(oidcSessionCallbackController),
);
