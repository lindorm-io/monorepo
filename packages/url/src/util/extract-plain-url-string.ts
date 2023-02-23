export const extractPlainUrlString = (url: URL): string => {
  const string = url.toString();
  if (!string.includes("?")) return string;
  return string.slice(0, string.indexOf("?"));
};
