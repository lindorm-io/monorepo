export type SendOtpRequestBody = {
  content: Record<string, unknown>;
  template: string;
  to: string;
  type: string;
};
