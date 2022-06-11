import { capitalize } from '@kickstartds/jsonschema-utils/dist/helpers';
import { NetlifyCmsConfig, NetlifyCmsCollection, NetlifyCmsField } from './@types';

const defaultConfig: NetlifyCmsConfig = {
  backend: {
    name: 'git-gateway',
    branch: 'master',
  },
  local_backend: true,
  locale: 'de',
  media_folder: 'static/images',
  public_folder: '/images',
  publish_mode: 'editorial_workflow',
  logo_url: 'https://example.com/logo.png',
  collections: [],
}

// TODO correct parameter documentation
export function createConfig(
    contentFields: NetlifyCmsField[],
    baseConfig: NetlifyCmsConfig = defaultConfig,
    collectionName: string = 'pages',
  ): NetlifyCmsConfig {

  const defaultMetaFields: NetlifyCmsField[] = [
    { label: 'Title', name: 'title', widget: 'string' },
    { label: 'Page URL', name: 'url', widget: 'string' },
    {
      label: 'Meta',
      name: 'meta',
      widget: 'object',
      fields: [
        { label: 'Title', name: 'title', widget: 'string' },
        { label: 'Description', name: 'description', widget: 'string' },
      ],
    },
  ]

  // TODO re-introduce `...defaultMetaFields` -> SEO
  const pages: NetlifyCmsCollection = {
    name: collectionName,
    label: capitalize(collectionName),
    label_singular: capitalize(collectionName).slice(0, -1),
    description: `${capitalize(collectionName)} consisting of default content elements`,
    folder: 'content',
    create: true,
    delete: true,
    identifier_field: 'title',
    extension: 'md',
    slug: '{{fields.slug}}',
    fields: contentFields[0].fields,
  }

  if (!baseConfig.collections) {
    baseConfig.collections = [];
  }

  const sortable = (field: NetlifyCmsField) => field.widget === 'object' || field.widget === 'list';

  const sortFields = (contentFieldA: NetlifyCmsField, contentFieldB: NetlifyCmsField) => {
    if (sortable(contentFieldA) && sortable(contentFieldB)) {
      if (contentFieldA.widget === 'object' && contentFieldB.widget ==='object') {
        return contentFieldA.name > contentFieldB.name ? 1 : -1;
      } else if (contentFieldA.widget === 'object' && contentFieldB.widget === 'list') {
        return -1;
      } else if (contentFieldA.widget === 'list' && contentFieldB.widget ==='object') {
        return 1;
      } else {
        return contentFieldA.name > contentFieldB.name ? 1 : -1;
      }
    } else if (sortable(contentFieldA) && !sortable(contentFieldB)) {
      return 1;
    } else if (!sortable(contentFieldA) && sortable(contentFieldB)) {
      return -1;
    } else {
      return contentFieldA.name > contentFieldB.name ? 1 : -1;
    }
  };

  const sortFieldsDeep = (fields: NetlifyCmsField[]) => {
    const sortedFields = fields.sort(sortFields);

    sortedFields.forEach((sortedField) => {
      if (sortedField.widget === 'list' && sortedField.types) {
        sortedField.types = sortFieldsDeep(sortedField.types);
      } else if (sortedField.widget === 'list' && sortedField.fields) {
        sortedField.fields = sortFieldsDeep(sortedField.fields);
      } else if (sortedField.widget === 'object' && sortedField.fields) {
        sortedField.fields = sortFieldsDeep(sortedField.fields);
      }
    });

    return sortedFields;
  };

  const sortedFields = sortFieldsDeep(contentFields);

  let pagesCollection = baseConfig.collections.find(
    (collection) => collection.name === collectionName
  );
  if (pagesCollection) {
    pagesCollection.fields = sortedFields;
  } else {
    baseConfig.collections.push(pages);
  }

  return baseConfig;
};
