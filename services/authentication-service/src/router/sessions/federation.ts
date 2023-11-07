import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { confirmFederationController, confirmFederationSchema } from "../../controller";

export const router = new Router<any, any>();

router.get(
  "/callback",
  paramsMiddleware,
  useSchema(confirmFederationSchema),
  useController(confirmFederationController),
);
