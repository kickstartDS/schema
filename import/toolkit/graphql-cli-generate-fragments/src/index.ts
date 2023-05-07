import { PluginFunction } from '@graphql-codegen/plugin-helpers';
import { generate } from './components/generate';

export const plugin: PluginFunction<any> = (schema) => {
  return generate(schema) + '\n\n';
};