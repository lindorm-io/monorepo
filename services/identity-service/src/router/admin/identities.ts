import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { identityEntityMiddleware } from "../../middleware";
import {
  ensureIdentityController,
  ensureIdentitySchema,
  getIdentityController,
  getIdentitySchema,
  updateIdentityController,
  updateIdentitySchema,
} from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

// Identities

router.put(
  "/:id",
  paramsMiddleware,
  useSchema(ensureIdentitySchema),
  useController(ensureIdentityController),
);

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(getIdentitySchema),
  identityEntityMiddleware("data.id"),
  useController(getIdentityController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateIdentitySchema),
  identityEntityMiddleware("data.id"),
  useController(updateIdentityController),
);
