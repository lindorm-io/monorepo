export const isObject = (input: any): input is Record<string, any> =>
  !!input &&
  typeof input === "object" &&
  input.constructor === Object &&
  !Array.isArray(input) &&
  !(input instanceof Date) &&
  !(input instanceof Error);
