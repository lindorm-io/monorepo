export interface Configuration {
  client:    Client;
  cookies:   Cookies;
  expiry:    Expiry;
  frontend:  Frontend;
  mongo:     Mongo;
  oauth:     Oauth;
  redirect:  Redirect;
  redis:     Mongo;
  server:    Server;
  services:  Services;
}

interface Client {
  default_active_state:       boolean;
  default_level_of_assurance: number;
}

interface Cookies {
  keys: string[];
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

interface Frontend {
  base_url: string;
  routes:   Routes;
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
  port:        number;
}

interface Services {
  authentication_service: string;
  identity_service:       string;
}

