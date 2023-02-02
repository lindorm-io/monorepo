export const isArray = <T>(input: any): input is Array<T> => !!input && Array.isArray(input);
