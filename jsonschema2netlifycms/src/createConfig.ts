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
    settingsFields: NetlifyCmsField[],
    baseConfig: NetlifyCmsConfig = defaultConfig,
    collectionName: string = 'pages',
    settingsName: string = 'settings',
  ): NetlifyCmsConfig {

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

  const sortedContentFields = sortFieldsDeep(contentFields);
  const sortedSettingsFields = sortFieldsDeep(settingsFields);

  const settingsFileConfigs = sortedSettingsFields.map((sortedSettingsField) => {
    // TODO path should be completely configurable (`content/settings`)
    return {
      name: sortedSettingsField.name,
      file: `content/settings/${sortedSettingsField.name}.md`,
      label: capitalize(sortedSettingsField.name),
      fields: sortedSettingsField.fields,
    };
  });

  const pages: NetlifyCmsCollection = {
    name: collectionName,
    label: capitalize(collectionName),
    label_singular: capitalize(collectionName).slice(0, -1),
    description: `${capitalize(collectionName)} documents consisting of default content elements`,
    folder: 'content',
    create: true,
    delete: true,
    identifier_field: 'title',
    extension: 'md',
    slug: '{{fields.slug}}',
    fields: sortedContentFields[0].fields,
  }

  const settings: NetlifyCmsCollection = {
    name: settingsName,
    label: capitalize(settingsName),
    label_singular: capitalize(settingsName).slice(0, -1),
    description: `${capitalize(settingsName)} consisting of general configuration options for the page`,
    extension: 'md',
    format: 'yaml-frontmatter',
    files: settingsFileConfigs,
  };

  if (!baseConfig.collections) {
    baseConfig.collections = [];
  }

  const pagesCollection = baseConfig.collections.find(
    (collection) => collection.name === collectionName
  );
  if (pagesCollection) {
    pagesCollection.fields = sortedContentFields[0].fields;
  } else {
    baseConfig.collections.push(pages);
  }

  const settingsCollection = baseConfig.collections.find(
    (collection) => collection.name === settingsName
  );
  if (settingsCollection) {
    settingsCollection.files = settingsFileConfigs;
  } else {
    baseConfig.collections.push(settings);
  }

  return baseConfig;
};
