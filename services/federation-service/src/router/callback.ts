import { redirectErrorMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  federationSessionCallbackController,
  federationSessionCallbackSchema,
} from "../controller";
import { federationSessionEntityMiddleware } from "../middleware";
import { configuration } from "../server/configuration";

export const router = new Router<any, any>();

router.get(
  "/",
  redirectErrorMiddleware({
    redirectUri: configuration.frontend.routes.error,
  }),
  useSchema(federationSessionCallbackSchema),
  federationSessionEntityMiddleware("data.state", { attributeKey: "state" }),
  useController(federationSessionCallbackController),
);
