const classInSubstring = (input: any): boolean =>
  input?.constructor?.toString()?.substring(0, 5) === "class";

export const isClass = (input: any): boolean =>
  Boolean(input) && input.prototype
    ? classInSubstring(input.prototype)
    : classInSubstring(input);
