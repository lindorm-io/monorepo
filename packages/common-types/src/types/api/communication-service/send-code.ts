export type SendCodeRequestBody = {
  content: Record<string, unknown>;
  template: string;
  to: string;
  type: string;
};
