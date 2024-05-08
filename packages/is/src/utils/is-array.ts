export const isArray = <T>(input: any): input is Array<T> => Boolean(input) && Array.isArray(input);
