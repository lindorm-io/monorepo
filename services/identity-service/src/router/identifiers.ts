import { LindormScopes } from "@lindorm-io/common-types";
import { identifierEntityMiddleware, identityAuthMiddleware } from "../middleware";
import { Router, paramsMiddleware, useController, useSchema } from "@lindorm-io/koa";
import {
  deleteIdentifierController,
  deleteIdentifierSchema,
  updateIdentifierController,
  updateIdentifierSchema,
} from "../controller";

const router = new Router();
export default router;

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateIdentifierSchema),
  identifierEntityMiddleware("data.id"),
  identityAuthMiddleware({
    scopes: [LindormScopes.OPENID],
    fromPath: {
      subject: "entity.identifier.identityId",
    },
  }),
  useController(updateIdentifierController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteIdentifierSchema),
  identifierEntityMiddleware("data.id"),
  identityAuthMiddleware({
    scopes: [LindormScopes.OPENID],
    fromPath: {
      subject: "entity.identifier.identityId",
    },
  }),
  useController(deleteIdentifierController),
);
