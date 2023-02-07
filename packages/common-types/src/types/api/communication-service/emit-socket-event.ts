export type EmitSocketEventRequestBody = {
  channels: {
    sessions?: Array<string>;
    deviceLinks?: Array<string>;
    identities?: Array<string>;
  };
  content: Record<string, unknown>;
  event: string;
};
