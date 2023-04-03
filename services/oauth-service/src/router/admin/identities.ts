import { getIdentitySessionsController, getIdentitySessionsSchema } from "../../controller";
import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get(
  "/:id/sessions",
  paramsMiddleware,
  useSchema(getIdentitySessionsSchema),
  useController(getIdentitySessionsController),
);
