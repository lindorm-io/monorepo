export const isError = (input: any): input is Error => Boolean(input) && input instanceof Error;
