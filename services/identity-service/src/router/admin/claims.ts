import { Router, useController, useSchema } from "@lindorm-io/koa";
import { getClaimsController, getClaimsSchema } from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.get("/", useSchema(getClaimsSchema), useController(getClaimsController));
