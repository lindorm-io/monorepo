export const isBooleanString = (input?: any): input is string =>
  input === "true" || input === "false";
