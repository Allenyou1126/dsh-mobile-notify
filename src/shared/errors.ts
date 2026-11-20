/** One configuration or protocol value that must stop plugin startup. */
export class ConfigError extends Error {
  public override readonly name = 'ConfigError'
}
