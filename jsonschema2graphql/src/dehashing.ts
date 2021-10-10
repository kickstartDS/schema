const typeResolutionField = 'type';

export function cleanFieldName(name: string): string {
  return name.replace(/__.*/i, '');
};

export function cleanObjectKeys(obj: Record<string, any>): Record<string, any> {
  const cleanedObject = {};

  Object.keys(obj).forEach((property) => {
    if (property !== typeResolutionField) {
      if (Array.isArray(obj[property])) {
        if (obj[property].length > 0) {
          cleanedObject[cleanFieldName(property)] = obj[property].map((item: Record<string, any>) => {
            return cleanObjectKeys(item);
          });
        }
      } else if (typeof obj[property] === 'object') {
        if (obj[property] !== null) {
          cleanedObject[cleanFieldName(property)] =
            cleanObjectKeys(obj[property]);
        }
      } else if (obj[property]) {
        if (obj[property] !== null) {
          // TODO re-simplify this... only needed because of inconsistent handling of `-` vs `_` in schema enum values
          // TODO also `graphqlSafeEnumKey.ts` is destructive right now, as in: you can't deterministically convert
          // values back to their original form, once they are made safe. This is why different properties (like `ratio`
          // or `pattern`) need to be handled explicitly here. To reconstruct the needed format. As properties can be
          // customized from a project-level (e.g. `pattern` already is an individualization for `kickstartDS/design-system`)
          // we can't have custom handling per property here. At least in the long run!
          if (cleanFieldName(property) === 'variant') {
            cleanedObject[cleanFieldName(property)] = obj[property].replace('_', '-');
          } else if (cleanFieldName(property) === 'ratio') {
            cleanedObject[cleanFieldName(property)] = obj[property].replace('VALUE_', '').replace('_', ':');
          } else if (cleanFieldName(property) === 'pattern') {
            cleanedObject[cleanFieldName(property)] = obj[property].replace('VALUE_', '');
          } else {
            cleanedObject[cleanFieldName(property)] = obj[property];
          }
        }
      }
    }
  });

  return cleanedObject;
};