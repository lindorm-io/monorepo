export const isNumber = <T extends number>(input?: any): input is T =>
  typeof input === "number";
