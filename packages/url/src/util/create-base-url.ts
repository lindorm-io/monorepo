type Options = {
  baseURL?: URL | string;
  host?: URL | string;
  port?: number;
};

export const createBaseUrl = ({ baseURL, host, port }: Options): URL => {
  if (host instanceof URL) {
    return host;
  }

  if (baseURL instanceof URL) {
    return baseURL;
  }

  if (host && port) {
    return new URL(`${host}:${port}`);
  }

  if (host) {
    return new URL(host);
  }

  if (baseURL && port) {
    return new URL(`${baseURL}:${port}`);
  }

  if (baseURL) {
    return new URL(baseURL);
  }

  throw new Error("Invalid options");
};
