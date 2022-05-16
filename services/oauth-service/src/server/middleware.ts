import { DefaultLindormMiddleware } from "@lindorm-io/koa";
import { axiosMiddleware } from "@lindorm-io/koa-axios";
import { configuration } from "./configuration";

export const middleware: Array<DefaultLindormMiddleware> = [
  axiosMiddleware({
    host: configuration.services.authentication_service.host,
    port: configuration.services.authentication_service.port,
    clientName: "authenticationClient",
  }),
  axiosMiddleware({
    host: configuration.services.identity_service.host,
    port: configuration.services.identity_service.port,
    clientName: "identityClient",
  }),
];
