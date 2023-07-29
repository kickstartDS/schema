import _ from 'lodash'
import * as path from 'path'
import uppercamelcase from 'uppercamelcase'

// TODO those two `s.includes('http')` paths are identical,
// should maybe do different things?
export const getTypeName = (s: string | undefined, outerSchemaId?: string): string => {
  if (_.isUndefined(s)) return ''
  return s.includes('#/definitions/')
    ? s.includes('http') 
      ? uppercamelcase(`${path.parse(outerSchemaId || '').name.replace('.schema', '').replace('.definitions', '')}Component-${path.parse(s).name}`)
      : uppercamelcase(`${path.parse(outerSchemaId || '').name.replace('.schema', '').replace('.definitions', '')}Component-${path.parse(s).name}`)
    : s.includes('interface')
      ? uppercamelcase(`${path.parse(s).name.replace('.interface', '')}Component`)
      : uppercamelcase(`${path.parse(s).name.replace('.schema', '').replace('.definitions', '')}Component`);
}
