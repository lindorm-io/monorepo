import { Axios } from "@lindorm-io/axios";
import { KoaContext } from "@lindorm-io/koa";

export interface AxiosContext extends KoaContext {
  axios: Record<string, Axios>;
}
