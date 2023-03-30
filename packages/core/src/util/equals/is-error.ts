export const isError = (input: any): input is Error => !!input && input instanceof Error;
