export type ConfirmRdcRequestParams = {
  id: string;
};

export type ConfirmRdcRequestBody = {
  challengeConfirmationToken: string;
  rdcSessionToken: string;
};
