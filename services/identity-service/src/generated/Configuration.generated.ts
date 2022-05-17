export interface Configuration {
  defaults:  Defaults;
  mongo:     Mongo;
  oauth:     Oauth;
  redis:     Mongo;
  server:    Server;
  services:  Services;
}

interface Defaults {
  connect_identifier_session_expiry: string;
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

interface Server {
  domain:      string;
  environment: string;
  host:        string;
  issuer:      string;
  port:        number;
}

interface Services {
  communication_service: Service;
  oauth_service:         Service;
}

interface Service {
  host:    string;
  issuer:  string;
  port:    number;
}

