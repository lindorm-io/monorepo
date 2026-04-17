import {
  ClientCredentialsAuthLocation,
  ClientCredentialsContentType,
} from "@lindorm/conduit";
import { Dict } from "@lindorm/types";
import { WebhookAuth, WebhookMethod } from "../enums";

export interface IWebhookSubscription {
  id: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;

  auth: WebhookAuth;
  event: string;
  method: WebhookMethod;
  headers: Dict<string>;
  ownerId: string;
  tenantId: string | null;
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

  // error tracking
  errorCount: number;
  lastErrorAt: Date | null;
  suspendedAt: Date | null;
}
