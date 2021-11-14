export const err = (msg: string, propName?: string | null): Error =>
  new Error(`jsonschema2sanity: ${propName ? `Couldn't convert property ${propName}. ` : ''}${msg}`)
