export const extractSearchParams = <T = Record<string, any>>(url: URL): T => {
  const query: Record<string, any> = {};

  url.searchParams.forEach((value, key) => {
    if (/\d+/.test(value)) {
      query[key] = parseInt(value);
    } else if (value === "true") {
      query[key] = true;
    } else if (value === "false") {
      query[key] = false;
    } else {
      query[key] = value;
    }
  });

  return query as T;
};
