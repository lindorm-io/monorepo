export interface SendSmsRequestData {
  content: Record<string, unknown>;
  template: string;
  to: string;
}
