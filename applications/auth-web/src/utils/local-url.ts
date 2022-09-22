export const localUrl = (path: string, query: Record<string, any> = {}): string => {
  const url = new URL(path, "http://rm.rm");

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.append(key, value.toString());
  }

  return url.toString().replace("http://rm.rm", "");
};
