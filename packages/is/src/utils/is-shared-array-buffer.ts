// `SharedArrayBuffer` only exists in cross-origin-isolated browser contexts, so
// the global is guarded the same way `isBuffer` guards `Buffer`.
export const isSharedArrayBuffer = (input?: any): input is SharedArrayBuffer =>
  typeof SharedArrayBuffer !== "undefined" &&
  Boolean(input) &&
  input instanceof SharedArrayBuffer;
