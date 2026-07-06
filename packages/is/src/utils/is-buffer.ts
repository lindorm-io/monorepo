export const isBuffer = (input?: any): input is Buffer =>
  typeof Buffer !== "undefined" && Buffer.isBuffer(input);
