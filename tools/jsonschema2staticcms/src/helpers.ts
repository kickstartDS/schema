import { IStaticCmsField } from './@types/index.js';

const sortable = (field: IStaticCmsField): boolean => field.widget === 'object' || field.widget === 'list';

const sortFields = (contentFieldA: IStaticCmsField, contentFieldB: IStaticCmsField): number => {
  if (sortable(contentFieldA) && sortable(contentFieldB)) {
    if (contentFieldA.widget === 'object' && contentFieldB.widget === 'object') {
      return contentFieldA.name > contentFieldB.name ? 1 : -1;
    } else if (contentFieldA.widget === 'object' && contentFieldB.widget === 'list') {
      return -1;
    } else if (contentFieldA.widget === 'list' && contentFieldB.widget === 'object') {
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

export function sortFieldsDeep(fields: IStaticCmsField[]): IStaticCmsField[] {
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
}
