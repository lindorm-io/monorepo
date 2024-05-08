export const isObjectLike = (input: any): input is Record<string, any> =>
  Boolean(input) && typeof input === "object" && !Array.isArray(input);
