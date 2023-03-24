export interface Configuration {
  defaults:  Defaults;
  frontend:  Frontend;
  logger:    Logger;
  mongo:     Mongo;
  oauth:     Oauth;
  redis:     Mongo;
  server:    Server;
  services:  Services;
}

interface Defaults {
  authentication_session_expiry: string;
  browser_link_cookie_expiry:    string;
  mfa_cookie_expiry:             string;
}

interface Frontend {
  host:    string;
  port:    number;
  routes:  Routes;
}

interface Routes {
  code_callback:  string;
  consent:        string;
  error:          string;
  login:          string;
  logout:         string;
  oidc:           string;
  select_account: string;
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
  client_id:     string;
  client_secret: string;
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
  communication_service: Service;
  device_service:        Service;
  identity_service:      Service;
  oauth_service:         Service;
  oidc_service:          Service;
  vault_service:         Service;
}

interface Service {
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
}

