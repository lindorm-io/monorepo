export interface SendEmailRequestData {
  content: Record<string, unknown>;
  template: string;
  to: string;
}
