export const isBooleanString = (input?: any): input is string =>
  typeof input === "string" && (input === "true" || input === "false");
