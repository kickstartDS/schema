import { TinaCloudSchema, TinaCloudCollection, TinaFieldInner } from '@tinacms/schema-tools';
import { capitalize } from '@kickstartds/jsonschema-utils/dist/helpers';

const defaultConfig: TinaCloudSchema<false> = {
  collections: []
};

// TODO correct parameter documentation
export function createConfig(
  contentFields: TinaFieldInner<false>[],
  baseConfig: TinaCloudSchema<false> = defaultConfig,
  collectionName: string,
  collectionLabel: string = capitalize(collectionName)
): TinaCloudSchema<false> {
  const pages: TinaCloudCollection<false> = {
    name: collectionName,
    label: collectionLabel,
    path: `content/${collectionName}`,
    fields: contentFields,
  }

  if (!baseConfig.collections) {
    baseConfig.collections = [];
  }

  let pagesCollection = baseConfig.collections.find(
    (collection) => collection.name === collectionName
  );
  if (pagesCollection) {
    pagesCollection.fields = contentFields;
  } else {
    baseConfig.collections.push(pages);
  }

  return baseConfig;
};
