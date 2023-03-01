import { isUrl } from "@lindorm-io/core";

export const getValidUrl = (url: URL | string, baseURL?: URL | string): URL => {
  if (isUrl(url)) return url;

  return new URL(url, baseURL);
};
