export const resolveStreamName = (prefix: string): string => {
  const sanitized = prefix.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return `IRIS_${sanitized}`;
};
