export const err = (msg: string, propName?: string | null): Error =>
  new Error(`jsonschema2netlifycms: ${propName ? `Couldn't convert property ${propName}. ` : ''}${msg}`)
