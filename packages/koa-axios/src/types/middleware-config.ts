import { AxiosOptions } from "@lindorm-io/axios";

export type AxiosMiddlewareConfig = AxiosOptions & Required<Pick<AxiosOptions, "clientName">>;
