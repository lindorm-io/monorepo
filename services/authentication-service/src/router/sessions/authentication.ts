import { authenticationSessionEntityMiddleware } from "../../middleware";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  getAuthenticationCodeController,
  getAuthenticationCodeSchema,
  getAuthenticationController,
  getAuthenticationSchema,
  initialiseAuthenticationController,
  initialiseAuthenticationSchema,
  initialiseOidcController,
  initialiseOidcSchema,
  initialiseStrategyController,
  initialiseStrategySchema,
  rejectAuthenticationController,
  rejectAuthenticationSchema,
  verifyAuthenticationController,
  verifyAuthenticationSchema,
} from "../../controller";

export const router = new Router<any, any>();

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

router.get(
  "/:id/code",
  paramsMiddleware,
  useSchema(getAuthenticationCodeSchema),
  authenticationSessionEntityMiddleware("data.id"),
  useController(getAuthenticationCodeController),
);

router.get(
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
  "/:id/reject",
  paramsMiddleware,
  useSchema(rejectAuthenticationSchema),
  authenticationSessionEntityMiddleware("data.id"),
  useController(rejectAuthenticationController),
);

router.post(
  "/:id/verify",
  paramsMiddleware,
  useSchema(verifyAuthenticationSchema),
  authenticationSessionEntityMiddleware("data.id"),
  useController(verifyAuthenticationController),
);
