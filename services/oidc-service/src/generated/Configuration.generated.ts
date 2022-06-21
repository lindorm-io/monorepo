export interface Configuration {
  frontend:        Frontend;
  logger:          Logger;
  oauth:           Oauth;
  oidc_providers:  OidcProvider[];
  redis:           Redis;
  server:          Server;
  services:        Services;
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

interface Redis {
  host:      string;
  password:  string;
  port:      number;
  username:  string;
}

interface Server {
  domain:      string;
  environment: string;
  host:        string;
  issuer:      string;
  keys:        any[];
  port:        number;
  workers:     boolean;
}

interface Services {
  identity_service: Service;
  oauth_service:    Service;
}

interface Service {
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
}

