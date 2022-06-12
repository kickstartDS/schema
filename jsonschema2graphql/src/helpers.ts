import camelcase from 'camelcase'
import { GraphQLList, GraphQLObjectType, GraphQLType } from 'graphql'
import pluralize from 'pluralize'
import { hashFieldName } from '@kickstartds/jsonschema-utils/dist/helpers';

import { EntryPointBuilder } from './@types'

const typeResolutionField = 'type';

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

export function hashObjectKeys(obj: Record<string, any>, outerComponent: string) {
  const hashedObj = {};

  if (!obj) return obj;

  Object.keys(obj).forEach((property) => {
    if (property === typeResolutionField) {
      hashedObj[typeResolutionField] = obj[typeResolutionField];
    } else {
      if (Array.isArray(obj[property]) && obj[property].length > 0 && (typeof obj[property][0] === 'string' || obj[property][0] instanceof String)) {
        hashedObj[hashFieldName(property, outerComponent)] = obj[property];
      } else if (Array.isArray(obj[property]) && obj[property].length > 0) {
        hashedObj[hashFieldName(property, outerComponent)] = obj[property].map((item: Record<string, any>) => {
          // TODO re-simplify this... only needed because of inconsistent hashing on sub-types
          // the main incompatibility lies with `dedupe` in `schemaReducer.js`, which handles
          // sub-types a bit differently
          if (outerComponent === 'logo-tiles') {
            return hashObjectKeys(item, 'picture');
          } else if (outerComponent === 'quotes-slider') {
            return hashObjectKeys(item, 'quote');
          } else if (outerComponent === 'post-head' && property === 'categories') {
            return hashObjectKeys(item, 'tag-label');
          } else if (outerComponent === 'text-media' && property === 'media') {
            return hashObjectKeys(item, 'media-image'); // TODO this also needs to handle `media-video` and other permutations
          } else {
            return hashObjectKeys(item, outerComponent === 'section' ? item[typeResolutionField] : outerComponent);
          }
        });
      } else if (typeof obj[property] === 'object') {
        // TODO re-simplify this... only needed because of inconsistent hashing on sub-types
        // the main incompatibility lies with `dedupe` in `schemaReducer.js`, which handles
        // sub-types a bit differently
        const outer = outerComponent === 'section' ? obj[property][typeResolutionField] : outerComponent;
        if ((outer === 'storytelling' && property === 'link') || (outer === 'count-up' && property === 'link')) {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'link-button');
        } else if (outer === 'glossary' && property === 'cta') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'cta');
        } else if (outer === 'cta' && property === 'link') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'link-button');
        } else if (outer === 'link-button' && property === 'icon') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'icon');
        } else if (outer === 'media-image' && property === 'image') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'picture');
        } else if (outer === 'contact' && property === 'image') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'picture');
        } else if (outer === 'post-aside' && property === 'meta') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'post-meta');
        } else if (outer === 'post-aside' && property === 'image') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'picture');
        } else if (outer === 'post-aside' && property === 'shareBar') {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], 'post-share-bar');
        } else {
          hashedObj[hashFieldName(property, outerComponent)] = hashObjectKeys(obj[property], outer);
        }
      } else {
        // TODO ideally, section handling should come naturally, too. Explicit handling should not be needed!
        hashedObj[hashFieldName(property, outerComponent === 'section' ? 'section' : outerComponent)] = obj[property];
      }
    }
  });

  return hashedObj;
};