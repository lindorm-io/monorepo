import { isUrl, isUrlLike } from "@lindorm/is";

type Options = {
  base?: URL | string;
  host?: URL | string;
  port?: number;
};

export const createBaseUrl = ({ base, host, port }: Options): URL => {
  const origin = host || base;

  if (!origin) {
    throw new Error(`Invalid options [ base: ${base} | host: ${host} ]`);
  }

  if (isUrl(origin)) {
    return origin;
  }

  const preferredHasPort = /:\d+/.test(origin);

  if (origin && port && !preferredHasPort) {
    return new URL(`${origin}:${port}`);
  }

  if (isUrlLike(origin)) {
    return new URL(origin);
  }

  throw new Error("Invalid options");
};
