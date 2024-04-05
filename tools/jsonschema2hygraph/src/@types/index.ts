import {
  BatchMigrationCreateComponentFieldInput,
  BatchMigrationCreateComponentInput,
  BatchMigrationCreateEnumerableFieldInput,
  BatchMigrationCreateEnumerationInput,
  BatchMigrationCreateSimpleFieldInput
} from '@hygraph/management-sdk';

export type ComponentType =
  | (BatchMigrationCreateComponentInput & { fields: FieldType[] })
  | BatchMigrationCreateEnumerationInput;
export type FieldType =
  | BatchMigrationCreateSimpleFieldInput
  | BatchMigrationCreateEnumerableFieldInput
  | BatchMigrationCreateComponentFieldInput;
