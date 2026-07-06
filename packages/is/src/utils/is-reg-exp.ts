export const isRegExp = (input: any): input is RegExp =>
  Boolean(input) && input instanceof RegExp;
