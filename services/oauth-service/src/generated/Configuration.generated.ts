import { ReadableTime } from "@lindorm-io/readable-time";

export interface Configuration {
  defaults: Defaults;
  frontend: Frontend;
  logger: Logger;
  mongo: Mongo;
  oauth: Oauth;
  redis: Mongo;
  server: Server;
  services: Services;
}

interface Defaults {
  expiry: Expiry;
  sessions: Sessions;
}

interface Expiry {
  access_token: ReadableTime;
  authentication_token_session: ReadableTime;
  authorization_session: ReadableTime;
  browser_session: ReadableTime;
  browser_session_remember: ReadableTime;
  claims_session: ReadableTime;
  client_credentials: ReadableTime;
  code_session: ReadableTime;
  elevation_session: ReadableTime;
  id_token: ReadableTime;
  logout_session: ReadableTime;
  refresh_token: ReadableTime;
}

interface Sessions {
  loa_1_max_days: number;
  loa_2_max_days: number;
  loa_3_max_days: number;
  loa_4_max_minutes: number;
}

interface Frontend {
  host: string;
  port: number;
  routes: FrontendRoutes;
}

interface FrontendRoutes {
  error: string;
}

interface Logger {
  colours: boolean;
  level: string;
  readable: boolean;
  timestamp: boolean;
}

interface Mongo {
  db_name: string;
  host: string;
  namespace: string;
  password: string;
  port: number;
  username: string;
}

interface Oauth {
  client_id: string;
}

interface Server {
  domain: string;
  environment: string;
  host: string;
  issuer: string;
  keys: string[];
  port: number;
  workers: boolean;
}

interface Services {
  authentication_service: AuthenticationService;
  identity_service: IdentityService;
}

interface AuthenticationService {
  client_id: string;
  client_name: string;
  host: string;
  issuer: string;
  port: number;
  routes: AuthenticationServiceRoutes;
}

interface AuthenticationServiceRoutes {
  admin: Admin;
  redirect: Redirect;
}

interface Admin {
  authentication_token: string;
  password: string;
}

interface Redirect {
  consent: string;
  elevate: string;
  login: string;
  logout: string;
  select: string;
}

interface IdentityService {
  client_id: string;
  client_name: string;
  host: string;
  issuer: string;
  port: number;
  routes: IdentityServiceRoutes;
}

interface IdentityServiceRoutes {
  claims: string;
  userinfo: string;
}
