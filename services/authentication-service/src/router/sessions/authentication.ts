import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  getAuthenticationCodeController,
  getAuthenticationCodeSchema,
  getAuthenticationController,
  getAuthenticationSchema,
  initialiseAuthenticationController,
  initialiseAuthenticationSchema,
  initialiseFederationController,
  initialiseFederationSchema,
  initialiseStrategyController,
  initialiseStrategySchema,
  rejectAuthenticationController,
  rejectAuthenticationSchema,
  verifyAuthenticationController,
  verifyAuthenticationSchema,
} from "../../controller";
import { authenticationSessionEntityMiddleware } from "../../middleware";

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
  "/:id/federation",
  paramsMiddleware,
  useSchema(initialiseFederationSchema),
  authenticationSessionEntityMiddleware("data.id"),
  useController(initialiseFederationController),
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
