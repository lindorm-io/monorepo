export const isNumberString = (input?: any): input is string => /^\d+$/.test(input);
