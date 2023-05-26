export interface Configuration {
  defaults:  Defaults;
  frontend:  Frontend;
  logger:    Logger;
  mongo:     Mongo;
  oauth:     Oauth;
  redirect:  Redirect;
  redis:     Mongo;
  server:    Server;
  services:  Services;
}

interface Defaults {
  clients:  Clients;
  expiry:   Expiry;
  sessions: Sessions;
  tenants:  Tenants;
}

interface Clients {
  active_state:         boolean;
  level_of_assurance:   number;
  opaque_access_tokens: boolean;
}

interface Expiry {
  access_token:                 string;
  authentication_token_session: string;
  authorization_session:        string;
  browser_session:              string;
  browser_session_remember:     string;
  claims_session:               string;
  client_credentials:           string;
  code_session:                 string;
  elevation_session:            string;
  id_token:                     string;
  logout_session:               string;
  refresh_token:                string;
}

interface Sessions {
  loa_1_max_days:    number;
  loa_2_max_days:    number;
  loa_3_max_days:    number;
  loa_4_max_minutes: number;
}

interface Tenants {
  active_state: boolean;
}

interface Frontend {
  host:    string;
  port:    number;
  routes:  FrontendRoutes;
}

interface FrontendRoutes {
  error: string;
}

interface Logger {
  colours:   boolean;
  level:     string;
  readable:  boolean;
  timestamp: boolean;
}

interface Mongo {
  db_name:    string;
  host:       string;
  namespace:  string;
  password:   string;
  port:       number;
  username:   string;
}

interface Oauth {
  client_id: string;
}

interface Redirect {
  consent: string;
  elevate: string;
  login:   string;
  logout:  string;
  select:  string;
}

interface Server {
  domain:      string;
  environment: string;
  host:        string;
  issuer:      string;
  keys:        string[];
  port:        number;
  workers:     boolean;
}

interface Services {
  authentication_service: AuthenticationService;
  identity_service:       IdentityService;
}

interface AuthenticationService {
  client_id:    string;
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
  routes:       AuthenticationServiceRoutes;
}

interface AuthenticationServiceRoutes {
  authentication_token: string;
  password:             string;
}

interface IdentityService {
  client_id:    string;
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
  routes:       IdentityServiceRoutes;
}

interface IdentityServiceRoutes {
  claims:   string;
  userinfo: string;
}

