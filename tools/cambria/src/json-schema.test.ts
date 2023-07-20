import { JSONSchema, TypeName } from 'json-schema-typed/draft-07';

import {
  addProperty,
  inside,
  map,
  headProperty,
  wrapProperty,
  hoistProperty,
  plungeProperty,
  renameProperty,
  convertValue
} from './helpers.js';
import { updateSchema } from './json-schema.js';
import { IProperty } from './lens-ops.js';

describe('transforming a json schema', () => {
  const v1Schema = {
    $schema: 'http://json-schema.org/draft-07/schema',
    type: 'object',
    title: 'ProjectDoc',
    description: 'An Arthropod project with some tasks',
    additionalProperties: false,
    $id: 'ProjectV1',
    properties: {
      name: {
        type: 'string',
        default: ''
      },
      summary: {
        type: 'string',
        default: ''
      }
    },
    required: ['name', 'summary']
  } as JSONSchema.Object; // need to convince typescript this is valid json schema

  describe('addProperty', () => {
    it('adds the property', () => {
      const newSchema = updateSchema(v1Schema, [addProperty({ name: 'description', type: TypeName.String })]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        description: { type: 'string', default: '' }
      });
    });

    it('supports nullable fields', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'description', type: [TypeName.String, TypeName.Null] })
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        description: { type: ['string', 'null'], default: null }
      });
    });

    it('uses default value if provided', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'description', type: TypeName.String, default: 'hi' })
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        description: { type: 'string', default: 'hi' }
      });
    });

    it('sets field as required', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'description', type: TypeName.String, required: true })
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        description: { type: TypeName.String, default: '' }
      });

      expect(newSchema.required).toEqual([...(v1Schema.required || []), 'description']);
    });

    it('fails when presented with invalid data', () => {
      const badData: { [key: string]: unknown } = { garbage: 'input' };
      expect(() => {
        updateSchema(v1Schema, [addProperty(badData as unknown as IProperty)]);
      }).toThrow();
    });
  });

  describe('renameProperty', () => {
    const newSchema = updateSchema(v1Schema, [renameProperty('name', 'title')]);

    it('adds a new property and removes the old property', () => {
      expect(newSchema.properties).toEqual({
        title: {
          type: 'string',
          default: ''
        },
        summary: {
          type: 'string',
          default: ''
        }
      });
    });

    it('removes the old property from required array', () => {
      expect(newSchema.required?.indexOf('name')).toEqual(-1);
    });
  });

  describe('convertValue', () => {
    it('changes the type on the existing property', () => {
      const newSchema = updateSchema(v1Schema, [
        convertValue(
          'summary',
          [
            { todo: false, inProgress: false, done: true },
            { false: 'todo', true: 'done' }
          ],
          TypeName.String,
          TypeName.Boolean
        )
      ]);

      expect(newSchema.properties).toEqual({
        name: {
          type: 'string',
          default: ''
        },
        summary: {
          type: 'boolean',
          default: false
        }
      });
    });

    it("doesn't update the schema when there's no type change", () => {
      const newSchema = updateSchema(v1Schema, [
        convertValue('summary', [{ something: 'another' }, { another: 'something' }])
      ]);

      expect(newSchema).toEqual(v1Schema);
    });

    it('fails when presented with invalid data', () => {
      const badData: { [key: string]: unknown } = { garbage: 'input' };
      expect(() => {
        updateSchema(v1Schema, [addProperty(badData as unknown as IProperty)]);
      }).toThrow();
    });
  });

  describe('inside', () => {
    it('adds new properties inside a key', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'metadata', type: TypeName.Object }),
        inside('metadata', [
          addProperty({ name: 'createdAt', type: TypeName.Number }),
          addProperty({ name: 'updatedAt', type: TypeName.Number })
        ])
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        metadata: {
          type: 'object',
          default: {},
          properties: {
            createdAt: {
              type: 'number',
              default: 0
            },
            updatedAt: {
              type: 'number',
              default: 0
            }
          },
          required: ['createdAt', 'updatedAt']
        }
      });
    });

    it('renames properties inside a key', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'metadata', type: TypeName.Object }),
        inside('metadata', [
          addProperty({ name: 'createdAt', type: TypeName.Number }),
          renameProperty('createdAt', 'created')
        ])
      ]);

      expect(newSchema.properties).toEqual({
        name: {
          type: 'string',
          default: ''
        },
        summary: {
          type: 'string',
          default: ''
        },
        metadata: {
          type: 'object',
          default: {},
          properties: {
            created: {
              type: 'number',
              default: 0
            }
          },
          required: ['created']
        }
      });
    });
  });

  describe('map', () => {
    it('adds new properties inside an array', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'tasks', type: TypeName.Array, items: { type: TypeName.Object as const } }),
        inside('tasks', [
          map([
            addProperty({ name: 'name', type: TypeName.String }),
            addProperty({ name: 'description', type: TypeName.String })
          ])
        ])
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        tasks: {
          type: 'array',
          default: [],
          items: {
            type: 'object',
            default: {},
            properties: {
              name: {
                type: 'string',
                default: ''
              },
              description: {
                type: 'string',
                default: ''
              }
            },
            required: ['name', 'description']
          }
        }
      });
    });

    it('renames properties inside an array', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'tasks', type: TypeName.Array, items: { type: TypeName.Object as const } }),
        inside('tasks', [
          map([addProperty({ name: 'name', type: TypeName.String }), renameProperty('name', 'title')])
        ])
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        tasks: {
          type: 'array',
          default: [],
          items: {
            type: 'object',
            default: {},
            properties: {
              title: {
                type: 'string',
                default: ''
              }
            },
            required: ['title']
          }
        }
      });
    });
  });

  describe('headProperty', () => {
    it('can turn an array into a scalar', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'assignees', type: TypeName.Array, items: { type: TypeName.String as const } }),
        headProperty('assignees')
      ]);

      // Really, the correct result would be:
      // { { type: 'null', type: 'string' }, default: 'Joe' } }
      // the behaviour you see below here doesn't really work with at least AJV
      // https://github.com/ajv-validator/ajv/issues/276
      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        assignees: { anyOf: [{ type: 'null' }, { type: TypeName.String, default: '' }] }
      });
    });

    it('can preserve schema information for an array of objects becoming a single object', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'assignees', type: TypeName.Array, items: { type: TypeName.Object as const } }),
        inside('assignees', [map([addProperty({ name: 'name', type: TypeName.String })])]),
        headProperty('assignees')
      ]);

      const expectedSchema = {
        ...v1Schema.properties,
        assignees: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              default: {},
              properties: {
                name: { type: 'string', default: '' }
              },
              required: ['name']
            }
          ]
        }
      };

      expect(newSchema.properties).toEqual(expectedSchema);
    });
  });

  describe('wrapProperty', () => {
    it('can wrap a scalar into an array', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'assignee', type: [TypeName.String, TypeName.Null] }),
        wrapProperty('assignee')
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        assignee: {
          type: 'array',
          default: [],
          items: {
            type: 'string' as const,
            default: ''
          }
        }
      });
    });

    it.skip('can wrap an object into an array', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'assignee', type: [TypeName.Object, TypeName.Null] }),
        inside('assignee', [
          addProperty({ name: 'id', type: TypeName.String }),
          addProperty({ name: 'name', type: TypeName.String })
        ]),
        wrapProperty('assignee')
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        assignee: {
          type: 'array',
          default: [],
          items: {
            type: 'object' as const,
            properties: {
              name: { type: TypeName.String, default: '' },
              id: { type: TypeName.String, default: '' }
            }
          }
        }
      });
    });
  });

  describe('hoistProperty', () => {
    it('hoists the property up in the schema', () => {
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'metadata', type: TypeName.Object }),
        inside('metadata', [
          addProperty({ name: 'createdAt', type: TypeName.Number }),
          addProperty({ name: 'editedAt', type: TypeName.Number })
        ]),
        hoistProperty('metadata', 'createdAt')
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        metadata: {
          type: 'object',
          default: {},
          properties: {
            editedAt: {
              type: TypeName.Number,
              default: 0
            }
          },
          required: ['editedAt']
        },
        createdAt: {
          type: TypeName.Number,
          default: 0
        }
      });
    });

    it('hoists up an object with child properties', () => {
      // hoist up a details object out of metadata
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'metadata', type: TypeName.Object }),
        inside('metadata', [
          addProperty({ name: 'details', type: TypeName.Object }),
          inside('details', [addProperty({ name: 'title', type: TypeName.String })])
        ]),
        hoistProperty('metadata', 'details')
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        metadata: {
          type: TypeName.Object,
          default: {},
          properties: {},
          required: []
        },
        details: {
          type: TypeName.Object,
          default: {},
          properties: {
            title: { type: 'string', default: '' }
          },
          required: ['title']
        }
      });
    });
  });

  describe('plungeProperty', () => {
    it('plunges the property down in the schema', () => {
      // move the existing summary down into a metadata object
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'metadata', type: TypeName.Object }),
        inside('metadata', [
          addProperty({ name: 'createdAt', type: TypeName.Number }),
          addProperty({ name: 'editedAt', type: TypeName.Number })
        ]),
        plungeProperty('metadata', 'summary')
      ]);

      expect(newSchema.properties).toEqual({
        name: v1Schema.properties?.name,
        metadata: {
          type: 'object',
          default: {},
          properties: {
            createdAt: {
              type: TypeName.Number,
              default: 0
            },
            editedAt: {
              type: TypeName.Number,
              default: 0
            },
            summary: {
              type: TypeName.String,
              default: ''
            }
          },
          required: ['createdAt', 'editedAt', 'summary']
        }
      });
    });

    it('fails when presented with invalid data', () => {
      expect(() => {
        updateSchema(v1Schema, [plungeProperty('metadata', 'nosaj-thing')]);
      }).toThrow();
    });

    it.skip('plunges an object down with its child properties', () => {
      // plunge metadata object into a container object
      const newSchema = updateSchema(v1Schema, [
        addProperty({ name: 'container', type: TypeName.Object }),
        addProperty({ name: 'metadata', type: TypeName.Object }),
        inside('metadata', [
          addProperty({ name: 'createdAt', type: TypeName.Number }),
          addProperty({ name: 'editedAt', type: TypeName.Number })
        ]),
        plungeProperty('container', 'metadata')
      ]);

      expect(newSchema.properties).toEqual({
        ...v1Schema.properties,
        container: {
          type: 'object',
          default: {},
          required: ['metadata'],
          properties: {
            metadata: {
              type: TypeName.Object,
              default: {},
              properties: {
                createdAt: {
                  type: TypeName.Number,
                  default: 0
                },
                editedAt: {
                  type: TypeName.Number,
                  default: 0
                }
              },
              required: ['createdAt', 'editedAt', 'summary']
            }
          }
        }
      });
    });
  });
});
