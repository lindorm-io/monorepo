export interface Configuration {
  crypto:   Crypto;
  expiry:   Expiry;
  mongo:    Mongo;
  oauth:    Oauth;
  redis:    Mongo;
  server:   Server;
  services: Services;
}

interface Crypto {
  aes: string;
  sha: string;
}

interface Expiry {
  challenge_confirmation_token:    string;
  challenge_session:               string;
  enrolment_session:               string;
  remote_device_challenge_session: string;
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

interface Server {
  environment: null | string;
  host:        string;
  port:        number;
}

interface Services {
  communication_service: string;
}

