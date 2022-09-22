import { authenticationSessionEntityMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  getAuthenticationController,
  getAuthenticationSchema,
  initialiseAuthenticationController,
  initialiseAuthenticationSchema,
  initialiseOidcController,
  initialiseOidcSchema,
  initialiseStrategyController,
  initialiseStrategySchema,
  verifyAuthenticationController,
  verifyAuthenticationSchema,
} from "../../controller";

const router = new Router();
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
  "/:id/oidc",
  paramsMiddleware,
  useSchema(initialiseOidcSchema),
  authenticationSessionEntityMiddleware("data.id"),
  useController(initialiseOidcController),
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
