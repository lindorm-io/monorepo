export const getOrigin = (url: string, baseUrl?: URL): string => {
  try {
    return new URL(url, baseUrl).origin;
  } catch {
    return url;
  }
};
