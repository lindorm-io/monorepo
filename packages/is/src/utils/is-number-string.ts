export const isNumberString = (input?: any): input is string =>
  typeof input === "string" && /^[-]?\d+$/.test(input);
