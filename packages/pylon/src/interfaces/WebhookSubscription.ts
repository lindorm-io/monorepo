import {
  ClientCredentialsAuthLocation,
  ClientCredentialsContentType,
} from "@lindorm/conduit";
import { Dict } from "@lindorm/types";
import { WebhookAuth } from "../enums";

export interface IWebhookSubscription {
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  auth: WebhookAuth;
  event: string;
  headers: Dict<string>;
  ownerId: string;
  url: string;

  // auth headers
  authHeaders: Dict<string>;

  // basic auth
  username: string | null;
  password: string | null;

  // client credentials
  audience: string | null;
  authLocation: ClientCredentialsAuthLocation | null;
  clientId: string | null;
  clientSecret: string | null;
  contentType: ClientCredentialsContentType | null;
  issuer: string | null;
  scope: Array<string>;
  tokenUri: string | null;
}
