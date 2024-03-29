import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LensSource, loadYamlLens, updateSchema } from '@kickstartds/cambria';
import { JSONSchema } from 'json-schema-typed/draft-07';

const _dirname: string = path.dirname(fileURLToPath(import.meta.url));

const headlineSchema: JSONSchema.Object = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'http://schema.kickstartds.com/base/headline.schema.json',
  title: 'Headline',
  description: 'Headline',
  type: 'object',
  properties: {
    level: {
      title: 'Level',
      description: 'Select the headline level to use, or p alternatively',
      type: 'string',
      enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'p'],
      default: 'h2'
    },
    styleAs: {
      title: 'Style',
      description: 'Select the headline style to use',
      type: 'string',
      enum: ['none', 'h1', 'h2', 'h3', 'h4', 'h5', 'p'],
      default: 'none'
    },
    align: {
      title: 'Alignment',
      description: 'Choose an alignment for the headline',
      type: 'string',
      enum: ['left', 'center', 'right'],
      default: 'left'
    },
    content: {
      title: 'Text',
      description: 'Text content for the headline',
      type: 'string',
      examples: ['Headline']
    },
    subheadline: {
      title: 'Subheadline',
      description: 'Text content for the optional subheadline',
      type: 'string'
    },
    spaceAfter: {
      title: 'Bottom spacing',
      description: 'Add additional spacing to the bottom of the headline',
      type: 'string',
      enum: ['minimum', 'small', 'large'],
      default: 'minimum'
    },
    className: {
      type: 'string',
      title: 'Additional Classes',
      description: 'Add additional css classes that should be applied to the headline'
    },
    component: {
      title: '`ks-component` attribute',
      description: 'Optional custom component identifier',
      type: 'string'
    }
  },
  additionalProperties: false,
  required: ['content']
};

const lensData: string = await fs.readFile(path.resolve(_dirname, `../resources/headline.lens.yml`), 'utf-8');
const lens: LensSource = loadYamlLens(lensData);
const updatedSchema: JSONSchema.Interface = updateSchema(headlineSchema, lens);

console.log('Updated headline.schema.json', updatedSchema);
