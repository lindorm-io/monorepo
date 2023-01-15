export const isObject = (input: any): input is Record<string, any> =>
  !!input && typeof input === "object" && input.constructor === Object;
