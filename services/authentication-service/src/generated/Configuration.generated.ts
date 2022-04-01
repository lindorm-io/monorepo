export interface Configuration {
  cookies:         Cookies;
  expiry:          Expiry;
  frontend:        Frontend;
  mongo:           Mongo;
  oauth:           Oauth;
  oidc_providers:  OidcProvider[];
  redis:           Mongo;
  server:          Server;
  services:        Services;
}

interface Cookies {
  keys: string[];
}

interface Expiry {
  browser_link_cookie: string;
  consent_session:     string;
  flow_session:        string;
  login_session:       string;
  mfa_cookie:          string;
}

interface Frontend {
  base_url: string;
  routes:   Routes;
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
  client_id:      string;
  client_secret:  string;
  host:           string;
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
  port:        number;
}

interface Services {
  communication_service: string;
  device_service:        string;
  identity_service:      string;
}

