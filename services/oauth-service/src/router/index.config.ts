import { cacheControlMiddleware } from "../middleware";
import { ServerKoaMiddleware } from "../types";

export const middleware: Array<ServerKoaMiddleware> = [cacheControlMiddleware];
