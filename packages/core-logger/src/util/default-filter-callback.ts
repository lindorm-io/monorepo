export const defaultFilterCallback = (data: any): string => {
  if (!data) return data;
  return "[Filtered]";
};
