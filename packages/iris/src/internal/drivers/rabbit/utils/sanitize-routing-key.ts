export const sanitizeRoutingKey = (key: string): string => {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
};
