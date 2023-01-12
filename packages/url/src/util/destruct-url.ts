import { Protocol, UrlData } from "../types";

const URL_REGEX = /(\w+\.+)+(\w+\.?)+(:\d+)?/;

const destruct = (url: URL): UrlData => {
  const query: Record<string, any> = {};

  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return {
    host: url.host.replace(/:\d+/, ""),
    pathname: url.pathname,
    port: url.port ? parseInt(url.port, 10) : undefined,
    protocol: url.protocol.replace(":", "") as Protocol,
    query,
  };
};

export const destructUrl = (url: URL | string | undefined): UrlData => {
  if (!url) {
    return {
      host: undefined,
      pathname: undefined,
      port: undefined,
      protocol: undefined,
      query: {},
    };
  }

  if (url instanceof URL) {
    return destruct(url);
  }

  if (url.startsWith("http")) {
    return destruct(new URL(url));
  }

  if (url.startsWith("/")) {
    return {
      host: undefined,
      pathname: url,
      port: undefined,
      protocol: undefined,
      query: {},
    };
  }

  if (URL_REGEX.test(url)) {
    return destruct(new URL(`https://${url}`));
  }

  return {
    host: undefined,
    pathname: url,
    port: undefined,
    protocol: undefined,
    query: {},
  };
};
