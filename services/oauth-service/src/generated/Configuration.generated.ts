export interface Configuration {
  defaults:  Defaults;
  frontend:  Frontend;
  mongo:     Mongo;
  oauth:     Oauth;
  redirect:  Redirect;
  redis:     Mongo;
  server:    Server;
  services:  Services;
}

interface Defaults {
  access_token_expiry:             string;
  authorization_session_expiry:    string;
  browser_session_expiry:          string;
  browser_session_remember_expiry: string;
  client_active_state:             boolean;
  client_credentials_expiry:       string;
  code_session_expiry:             string;
  id_token_expiry:                 string;
  level_of_assurance:              number;
  logout_session_expiry:           string;
  refresh_session_expiry:          string;
  tenant_active_state:             boolean;
}

interface Frontend {
  host:    string;
  port:    number;
  routes:  Routes;
}

interface Routes {
  error: string;
}

interface Mongo {
  db_name:   string;
  host:      string;
  password:  string;
  port:      number;
  username:  string;
}

interface Oauth {
  client_id: string;
}

interface Redirect {
  consent: string;
  login:   string;
  logout:  string;
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
  authentication_service: Service;
  identity_service:       Service;
}

interface Service {
  host:    string;
  issuer:  string;
  port:    number;
}

