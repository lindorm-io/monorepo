export enum IdentityPermission {
  ADMIN = "lindorm.io/any/identity/any:admin",
  USER = "lindorm.io/any/identity/any:user",

  CLIENT_ADMIN = "lindorm.io/oauth-service/identity/client:admin",
  CLIENT_WRITE = "lindorm.io/oauth-service/identity/client:write",
  CLIENT_READ = "lindorm.io/oauth-service/identity/client:read",

  IDENTITY_ADMIN = "lindorm.io/identity-service/identity/identity:admin",
  IDENTITY_WRITE = "lindorm.io/identity-service/identity/identity:write",
  IDENTITY_READ = "lindorm.io/identity-service/identity/identity:read",

  TENANT_ADMIN = "lindorm.io/oauth-service/identity/tenant:admin",
  TENANT_WRITE = "lindorm.io/oauth-service/identity/tenant:write",
  TENANT_READ = "lindorm.io/oauth-service/identity/tenant:read",
}
