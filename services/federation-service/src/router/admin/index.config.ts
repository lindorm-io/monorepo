import { ServerKoaMiddleware } from "../../types";
import { clientAuthMiddleware } from "../../middleware";

export const middleware: Array<ServerKoaMiddleware> = [clientAuthMiddleware()];
