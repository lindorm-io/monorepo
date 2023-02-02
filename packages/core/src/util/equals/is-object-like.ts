export const isObjectLike = (input: any): input is Record<string, any> =>
  !!input && typeof input === "object" && !Array.isArray(input);
