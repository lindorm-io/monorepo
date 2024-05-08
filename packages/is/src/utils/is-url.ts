export const isUrl = (input: any): input is URL => Boolean(input) && input instanceof URL;
