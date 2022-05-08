export interface EmitSocketEventRequestData {
  channels: {
    sessions?: Array<string>;
    deviceLinks?: Array<string>;
    identities?: Array<string>;
  };
  content: Record<string, unknown>;
  event: string;
}
