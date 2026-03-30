export const getOrigin = (url: string, baseURL?: URL): string => {
  try {
    return new URL(url, baseURL).origin;
  } catch {
    return url;
  }
};
