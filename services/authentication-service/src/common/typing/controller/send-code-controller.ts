export interface SendCodeRequestData {
  content: Record<string, unknown>;
  template: string;
  to: string;
  type: string;
}
