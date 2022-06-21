export interface Configuration {
  defaults:  Defaults;
  logger:    Logger;
  mongo:     Mongo;
  oauth:     Oauth;
  redis:     Mongo;
  server:    Server;
  services:  Services;
}

interface Defaults {
  challenge_confirmation_token_expiry:    string;
  challenge_session_expiry:               string;
  enrolment_session_expiry:               string;
  remote_device_challenge_session_expiry: string;
}

interface Logger {
  colours:   boolean;
  level:     string;
  readable:  boolean;
  timestamp: boolean;
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
  keys:        any[];
  port:        number;
  workers:     boolean;
}

interface Services {
  communication_service: Service;
  oauth_service:         Service;
  vault_service:         Service;
}

interface Service {
  client_name:  string;
  host:         string;
  issuer:       string;
  port:         number;
}

