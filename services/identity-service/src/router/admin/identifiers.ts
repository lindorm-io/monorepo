import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import {
  clientAuthMiddleware,
  identifierEntityMiddleware,
  identityEntityMiddleware,
} from "../../middleware";
import {
  addIdentifierController,
  addIdentifierSchema,
  deleteIdentifierController,
  deleteIdentifierSchema,
  updateIdentifierController,
  updateIdentifierSchema,
} from "../../controller";

const router = new Router<any, any>();
export default router;

router.use(
  clientAuthMiddleware(),
  //TODO: Add permissions middleware
);

router.post(
  "/",
  paramsMiddleware,
  useSchema(addIdentifierSchema),
  identityEntityMiddleware("data.identityId"),
  useController(addIdentifierController),
);

router.patch(
  "/:id",
  paramsMiddleware,
  useSchema(updateIdentifierSchema),
  identifierEntityMiddleware("data.id"),
  identityEntityMiddleware("entity.identifier.identityId"),
  useController(updateIdentifierController),
);

router.delete(
  "/:id",
  paramsMiddleware,
  useSchema(deleteIdentifierSchema),
  identifierEntityMiddleware("data.id"),
  identityEntityMiddleware("entity.identifier.identityId"),
  useController(deleteIdentifierController),
);
