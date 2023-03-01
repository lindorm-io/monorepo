export const getPlainUrl = (url: URL): URL => {
  const { origin, pathname } = url;

  return new URL(pathname, origin);
};
