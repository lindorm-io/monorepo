export const isNumber = (input?: any): input is number =>
  Boolean(input) && typeof input === "number";
