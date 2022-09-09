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
  active_state:       boolean;
  level_of_assurance: number;
}

interface Expiry {
  access_token:             string;
  authorization_session:    string;
  browser_session:          string;
  browser_session_remember: string;
  client_credentials:       string;
  code_session:             string;
  id_token:                 string;
  logout_session:           string;
  refresh_session:          string;
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
  routes:  Routes;
}

interface Routes {
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
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
}

