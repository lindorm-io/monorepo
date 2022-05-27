export interface Configuration {
  defaults:        Defaults;
  frontend:        Frontend;
  mongo:           Mongo;
  oauth:           Oauth;
  oidc_providers:  OidcProvider[];
  redis:           Mongo;
  server:          Server;
  services:        Services;
}

interface Defaults {
  browser_link_cookie_expiry: string;
  consent_session_expiry:     string;
  flow_session_expiry:        string;
  login_session_expiry:       string;
  mfa_cookie_expiry:          string;
}

interface Frontend {
  host:    string;
  port:    number;
  routes:  Routes;
}

interface Routes {
  consent: string;
  error:   string;
  login:   string;
  logout:  string;
}

interface Mongo {
  db_name:   string;
  host:      string;
  password:  string;
  port:      number;
  username:  string;
}

interface Oauth {
  client_id:     string;
  client_secret: string;
}

interface OidcProvider {
  authorize_endpoint: string;
  base_url:           string;
  client_id:          string;
  client_secret:      string;
  key:                string;
  loa_value:          number;
  response_type:      string;
  scope:              string;
  token_endpoint:     string;
  token_issuer:       string;
  userinfo_endpoint:  string;
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
  vault_service:         Service;
}

interface Service {
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
}

