import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  getFederationSessionController,
  getFederationSessionSchema,
  initialiseFederationSessionController,
  initialiseFederationSessionSchema,
} from "../../controller";
import { federationSessionEntityMiddleware } from "../../middleware";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/",
  useSchema(initialiseFederationSessionSchema),
  useController(initialiseFederationSessionController),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getFederationSessionSchema),
  federationSessionEntityMiddleware("data.id"),
  useController(getFederationSessionController),
);
