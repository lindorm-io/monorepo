export type OpenIdClientType =
  /**
   * Clients capable of maintaining the confidentiality of
   * their credentials (e.g., client implemented on a secure
   * server with restricted access to the client
   * credentials), or capable of secure client authentication
   * using other means.
   */
  | "confidential"

  /**
   * Clients incapable of maintaining the confidentiality of
   * their credentials (e.g., clients executing on the device
   * used by the resource owner, such as an installed native
   * application or a web browser-based application), and
   * incapable of secure client authentication via any other
   * means.
   */
  | "public";
