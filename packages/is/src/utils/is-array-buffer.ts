export const isArrayBuffer = (input: any): input is ArrayBuffer =>
  Boolean(input) && input instanceof ArrayBuffer;
