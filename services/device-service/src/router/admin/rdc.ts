import { Router, useController, useSchema } from "@lindorm-io/koa";
import { initialiseRdcController, initialiseRdcSchema } from "../../controller";

export const router = new Router<any, any>();

//TODO: Add permissions middleware

router.post("/", useSchema(initialiseRdcSchema), useController(initialiseRdcController));
