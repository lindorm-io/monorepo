import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { oidcSessionEntityMiddleware } from "../../middleware";
import {
  getOidcSessionController,
  getOidcSessionSchema,
  initialiseOidcSessionController,
  initialiseOidcSessionSchema,
} from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post(
  "/",
  useSchema(initialiseOidcSessionSchema),
  useController(initialiseOidcSessionController),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getOidcSessionSchema),
  oidcSessionEntityMiddleware("data.id"),
  useController(getOidcSessionController),
);
