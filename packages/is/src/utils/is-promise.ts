export const isPromise = (input?: any): input is Promise<any> =>
  Boolean(input) &&
  typeof input.then === "function" &&
  typeof input.catch === "function" &&
  typeof input.finally === "function";
