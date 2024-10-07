export const quotation = (identifier: string): string => {
  return `"${identifier.replace(/"/g, "").trim()}"`;
};
