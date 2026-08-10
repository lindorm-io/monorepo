export const isDataView = (input: any): input is DataView =>
  Boolean(input) && input instanceof DataView;
