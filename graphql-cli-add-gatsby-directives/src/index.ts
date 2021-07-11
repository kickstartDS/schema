import { PluginFunction } from '@graphql-codegen/plugin-helpers';
import { augment } from './components/augment';

export const plugin: PluginFunction<any> = (schema) => {
  return (augment(schema) + '\n\n')
    .replace('interface File', '')
    .replace('schema {\n  query: Query\n}\n\n', '');
};