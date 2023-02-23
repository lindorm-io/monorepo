const extractValid = (url: URL): URL => {
  try {
    url.toString();
    return url;
  } catch (err) {
    throw new Error(`Invalid URL [ ${url} ]`);
  }
};

export const extractValidUrl = (url: URL | string, baseURL?: URL | string): URL => {
  if (url instanceof URL) {
    return extractValid(url);
  }
  return extractValid(new URL(url, baseURL?.toString()));
};
