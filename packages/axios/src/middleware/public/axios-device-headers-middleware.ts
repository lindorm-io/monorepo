import { Middleware } from "../../types";

type Options = {
  installationId?: string;
  ip?: string;
  linkId?: string;
  name?: string;
  systemVersion?: string;
  uniqueId?: string;
};

export const axiosDeviceHeadersMiddleware =
  ({ installationId, ip, linkId, name, systemVersion, uniqueId }: Options): Middleware =>
  async (ctx, next) => {
    if (installationId) ctx.req.headers["x-device-installation-id"] = installationId;
    if (ip) ctx.req.headers["x-device-ip"] = ip;
    if (linkId) ctx.req.headers["x-device-link-id"] = linkId;
    if (name) ctx.req.headers["x-device-name"] = name;
    if (systemVersion) ctx.req.headers["x-device-system-version"] = systemVersion;
    if (uniqueId) ctx.req.headers["x-device-unique-id"] = uniqueId;

    await next();
  };
