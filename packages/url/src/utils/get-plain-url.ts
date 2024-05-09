import { isUrl } from "@lindorm/is";

export const getPlainUrl = (url: URL | string): URL => {
  const { origin, pathname } = isUrl(url) ? url : new URL(url);

  return new URL(pathname, origin);
};
