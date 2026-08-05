import { isUrl } from "@lindorm/is";

export const getValidUrl = (url: URL | string, baseUrl?: URL | string): URL => {
  if (isUrl(url)) return url;

  return new URL(url, baseUrl);
};
