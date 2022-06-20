import { Router } from "@lindorm-io/koa/dist/class/KoaApp";
import { ServerKoaContext } from "../types";
import { getProvidersListController } from "../controller";
import { useController } from "@lindorm-io/koa";

const router = new Router<unknown, ServerKoaContext>();
export default router;

router.get("/", useController(getProvidersListController));
