import { Router, useController, paramsMiddleware, useSchema } from "@lindorm-io/koa";
import { Scope } from "../common";
import { ServerKoaContext } from "../types";
import { identityAuthMiddleware, identityEntityMiddleware } from "../middleware";
import {
  identifierRemoveController,
  identifierRemoveSchema,
  identifierSetPrimaryController,
  identifierSetPrimarySchema,
  identityGetController,
  identityGetSchema,
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
