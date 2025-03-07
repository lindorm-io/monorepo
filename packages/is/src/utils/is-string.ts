export const isString = <T = string>(input?: any): input is T =>
  typeof input === "string";
