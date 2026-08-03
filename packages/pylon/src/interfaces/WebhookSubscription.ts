import type {
  ClientCredentialsAuthLocation,
  ClientCredentialsContentType,
} from "@lindorm/conduit";
import type { Dict } from "@lindorm/types";
import type { WebhookAuth, WebhookMethod } from "../enums/index.js";

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
  /** Sent to the token endpoint as the RFC 8707 `resource` indicator. */
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
