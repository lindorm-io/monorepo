import { paramsMiddleware, Router, useController, useSchema } from "@lindorm-io/koa";
import { identityEntityMiddleware } from "../../middleware";
import { addUserinfoController, addUserinfoSchema } from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.put(
  "/:id",
  paramsMiddleware,
  useSchema(addUserinfoSchema),
  identityEntityMiddleware("data.id"),
  useController(addUserinfoController),
);
