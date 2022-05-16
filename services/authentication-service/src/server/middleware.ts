import { DefaultLindormMiddleware } from "@lindorm-io/koa";
import { axiosMiddleware } from "@lindorm-io/koa-axios";
import { configuration } from "./configuration";

export const middleware: Array<DefaultLindormMiddleware> = [
  axiosMiddleware({
    host: configuration.services.communication_service.host,
    port: configuration.services.communication_service.port,
    clientName: "communicationClient",
  }),
  axiosMiddleware({
    host: configuration.services.device_service.host,
    port: configuration.services.device_service.port,
    clientName: "deviceLinkClient",
  }),
  axiosMiddleware({
    host: configuration.services.identity_service.host,
    port: configuration.services.identity_service.port,
    clientName: "identityClient",
  }),
  axiosMiddleware({
    host: configuration.services.oauth_service.host,
    port: configuration.services.oauth_service.port,
    clientName: "oauthClient",
  }),
];
