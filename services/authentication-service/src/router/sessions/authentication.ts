import { ServerKoaContext } from "../../types";
import { authenticationSessionEntityMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  getAuthenticationController,
  getAuthenticationSchema,
  initialiseAuthenticationController,
  initialiseAuthenticationSchema,
  initialiseStrategyController,
  initialiseStrategySchema,
  verifyAuthenticationController,
  verifyAuthenticationSchema,
} from "../../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.post(
  "/",
  useSchema(initialiseAuthenticationSchema),
  useController(initialiseAuthenticationController),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getAuthenticationSchema),
  authenticationSessionEntityMiddleware("data.id"),
  useController(getAuthenticationController),
);

router.post(
  "/:id/strategy",
  paramsMiddleware,
  useSchema(initialiseStrategySchema),
  authenticationSessionEntityMiddleware("data.id"),
  useController(initialiseStrategyController),
);

router.post(
  "/:id/verify",
  paramsMiddleware,
  useSchema(verifyAuthenticationSchema),
  authenticationSessionEntityMiddleware("data.id"),
  useController(verifyAuthenticationController),
);
