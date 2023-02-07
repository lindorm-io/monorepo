export type ConfirmEnrolmentRequestParams = {
  id: string;
};

export type ConfirmEnrolmentRequestBody = {
  biometry: string;
  certificateVerifier: string;
  enrolmentSessionToken: string;
  pincode: string;
};

export type ConfirmEnrolmentResponse = {
  challengeConfirmationToken: string;
  deviceLinkId: string;
  expiresIn: number;
  trusted: boolean;
};
