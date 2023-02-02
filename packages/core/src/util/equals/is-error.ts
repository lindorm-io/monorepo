export const isError = <T>(input: any): input is Error => !!input && input instanceof Error;
