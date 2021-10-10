import camelcase from 'camelcase'
import { GraphQLList, GraphQLObjectType, GraphQLType } from 'graphql'
import pluralize from 'pluralize'
import { createHash } from "crypto";

import { EntryPointBuilder } from './@types'

const typeResolutionField = 'type';

/** This generates the default `Query` block of the schema. */
export const DEFAULT_ENTRY_POINTS: EntryPointBuilder = types => ({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: Object.entries(types).reduce(
      (prevResult: any, [typeName, type]: [string, GraphQLType]) => ({
        ...prevResult,
        [camelcase(pluralize(typeName))]: { type: new GraphQLList(type) },
      }),
      new Map()
    ),
  }),
})

export const err = (msg: string, propName?: string | null): Error =>
  new Error(`jsonschema2graphql: ${propName ? `Couldn't convert property ${propName}. ` : ''}${msg}`)

export function hashFieldName(fieldName: string, optionalName?: string): string {
  return fieldName.includes('___NODE')
    ? `${fieldName.replace('___NODE', '')}__${createHash('md5').update(fieldName.replace('___NODE', '') + (optionalName || '')).digest('hex').substr(0,4)}___NODE`
    : `${fieldName}__${createHash('md5').update(fieldName + (optionalName || '')).digest('hex').substr(0,4)}`;
};

export function hashObjectKeys(obj: Record<string, any>, outerComponent: string) {
  const hashedObj = {};

  if (!obj) return obj;

  Object.keys(obj).forEach((property) => {
    if (property === typeResolutionField) {
      hashedObj[typeResolutionField] = obj[typeResolutionField];
    } else {
      if (Array.isArray(obj[property])) {
        hashedObj[hashFieldName(property, outerComponent)] = obj[property].map((item: Record<string, any>) => {
          // TODO re-simplify this... only needed because of inconsistent hashing on sub-types / picture
          if (outerComponent === 'logo-tiles') {
            return hashObjectKeys(item, 'picture');
          } else if (outerComponent === 'quotes-slider') {
            return hashObjectKeys(item, 'quote');
          } else if (outerComponent === 'post-head' && property === 'categories') {
            return hashObjectKeys(item, 'tag-label');
          } else {
            return hashObjectKeys(item, outerComponent === 'section' ? item[typeResolutionField] : outerComponent);
          }
        });
      } else if (typeof obj[property] === 'object') {
        // TODO re-simplify this... only needed because of inconsistent hashing on sub-types / link-button
        const outer = outerComponent === 'section' ? obj[property][typeResolutionField] : outerComponent;
        if (outer === 'storytelling' && property === 'link') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'link-button');
        } else if (outer === 'storytelling' && property === 'headline') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'headline');
        } else {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], outer);
        }
      } else {
        hashedObj[hashFieldName(property, outerComponent === 'section' ? 'section' : outerComponent)] = obj[property];
      }
    }
  });

  return hashedObj;
};