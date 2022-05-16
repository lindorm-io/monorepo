import { ServerKoaContext } from "../types";
import { Scope } from "../common";
import { identityAuthMiddleware, identityEntityMiddleware } from "../middleware";
import { Router, useController, paramsMiddleware, useSchema } from "@lindorm-io/koa";
import {
  identifierRemoveController,
  identifierRemoveSchema,
  identifierSetPrimaryController,
  identifierSetPrimarySchema,
  identityGetController,
  identityGetSchema,
  identityRemoveController,
  identityRemoveSchema,
  identityUpdateController,
  identityUpdateSchema,
} from "../controller";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get(
  "/:id",
  paramsMiddleware,
  useSchema(identityGetSchema),
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
    fromPath: { subject: "data.id" },
  }),
  identityEntityMiddleware("data.id"),
  useController(identityGetController),
);

router.put(
  "/:id",
  paramsMiddleware,
  useSchema(identityUpdateSchema),
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
    fromPath: { subject: "data.id" },
  }),
  identityEntityMiddleware("data.id"),
  useController(identityUpdateController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(identityRemoveSchema),
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
    fromPath: { subject: "data.id" },
  }),
  identityEntityMiddleware("data.id"),
  useController(identityRemoveController),
);

router.delete(
  "/:id/identifiers/:type",
  paramsMiddleware,
  useSchema(identifierRemoveSchema),
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
    fromPath: { subject: "data.id" },
  }),
  identityEntityMiddleware("data.id"),
  useController(identifierRemoveController),
);

router.put(
  "/:id/identifiers/:type/set-primary",
  paramsMiddleware,
  useSchema(identifierSetPrimarySchema),
  identityAuthMiddleware({
    scopes: [Scope.OPENID],
    fromPath: { subject: "data.id" },
  }),
  identityEntityMiddleware("data.id"),
  useController(identifierSetPrimaryController),
);
