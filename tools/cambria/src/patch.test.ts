import { ReplaceOperation } from 'fast-json-patch';
import { JSONSchema7 } from 'json-schema';

import { applyLensToDoc } from './doc.js';
import {
  renameProperty,
  addProperty,
  inside,
  map,
  hoistProperty,
  plungeProperty,
  wrapProperty,
  headProperty,
  convertValue
} from './helpers.js';
import { updateSchema, schemaForLens } from './json-schema.js';
import { LensSource } from './lens-ops.js';
import { Patch, applyLensToPatch, PatchOp, expandPatch } from './patch.js';
import { reverseLens } from './reverse.js';

export interface IProjectV1 {
  title: string;
  tasks: { title: string }[];
  complete: boolean;
  metadata: {
    createdAt: number;
    updatedAt: number;
  };
}

export interface IProjectV2 {
  name: string;
  description: string;
  issues: { title: string }[];
  status: string;
  metadata: {
    createdAt: number;
    updatedAt: number;
  };
}

const lensSource: LensSource = [
  renameProperty('title', 'name'),
  addProperty({ name: 'description', type: 'string', default: '' }),
  convertValue(
    'complete',
    [
      { false: 'todo', true: 'done' },
      { todo: false, inProgress: false, done: true }
    ],
    'boolean',
    'string'
  )
];

const projectV1Schema = {
  $schema: 'http://json-schema.org/draft-07/schema',
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    title: { type: 'string' as const },
    tasks: {
      type: 'array' as const,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' }
        }
      }
    },
    complete: { type: 'boolean' as const },
    metadata: {
      type: 'object',
      properties: {
        createdAt: { type: 'number', default: 123 },
        updatedAt: { type: 'number', default: 123 }
      }
    }
  }
} as const;

// ======================================
// Try sending a patch through the lens
// ======================================

describe('field rename', () => {
  it('converts upwards', () => {
    // Generate an edit from V1: setting the title field
    // (todo: try the json patch library's observer as an ergonomic interface?)
    const editTitleV1: Patch = [
      {
        op: 'replace' as const,
        path: '/title',
        value: 'new title'
      }
    ];
    // test the converted patch

    expect(applyLensToPatch(lensSource, editTitleV1, projectV1Schema)).toEqual([
      { op: 'replace', path: '/name', value: 'new title' }
    ]);
  });

  it('does not rename another property that starts with same string', () => {
    const editTitleBla: Patch = [
      {
        op: 'replace' as const,
        path: '/title_bla',
        value: 'new title'
      }
    ];

    expect(applyLensToPatch(lensSource, editTitleBla, projectV1Schema)).toEqual(editTitleBla);
  });

  it('converts downwards', () => {
    // We can also use the left lens to convert a v2 patch into a v1 patch
    const editNameV2: Patch = [
      {
        op: 'replace' as const,
        path: '/name',
        value: 'new name'
      }
    ];

    expect(
      applyLensToPatch(reverseLens(lensSource), editNameV2, updateSchema(projectV1Schema, lensSource))
    ).toEqual([{ op: 'replace', path: '/title', value: 'new name' }]);
  });

  it('works with whole doc conversion too', () => {
    // fills in default values for missing fields
    expect(applyLensToDoc(lensSource, { title: 'hello' }, projectV1Schema)).toEqual({
      complete: '',
      description: '',
      name: 'hello',
      tasks: [],
      metadata: {
        createdAt: 123,
        updatedAt: 123
      }
    });
  });
});

describe('add field', () => {
  it('becomes an empty patch when reversed', () => {
    const editDescription: Patch = [
      {
        op: 'replace' as const,
        path: '/description',
        value: 'going swimmingly'
      }
    ];
    expect(
      applyLensToPatch(reverseLens(lensSource), editDescription, updateSchema(projectV1Schema, lensSource))
    ).toEqual([]);
  });
});

// ======================================
// Demo more complex conversions than a rename: todo boolean case
// ======================================

describe('value conversion', () => {
  it('converts from a boolean to a string enum', () => {
    const setComplete: Patch = [
      {
        op: 'replace' as const,
        path: '/complete',
        value: true
      }
    ];

    expect(applyLensToPatch(lensSource, setComplete, projectV1Schema)).toEqual([
      { op: 'replace', path: '/complete', value: 'done' }
    ]);
  });

  it('reverse converts from a string enum to a boolean', () => {
    const setStatus: Patch = [
      {
        op: 'replace' as const,
        path: '/complete',
        value: 'inProgress'
      }
    ];

    expect(
      applyLensToPatch(reverseLens(lensSource), setStatus, updateSchema(projectV1Schema, lensSource))
    ).toEqual([{ op: 'replace', path: '/complete', value: false }]);
  });

  it('handles a value conversion and a rename in the same lens', () => {
    const lensSource = [
      renameProperty('complete', 'status'),
      convertValue(
        'status',
        [
          { false: 'todo', true: 'done' },
          { todo: false, inProgress: false, done: true }
        ],
        'boolean',
        'string'
      )
    ];

    const setComplete: Patch = [
      {
        op: 'replace' as const,
        path: '/complete',
        value: true
      }
    ];

    expect(applyLensToPatch(lensSource, setComplete, projectV1Schema)).toEqual([
      { op: 'replace', path: '/status', value: 'done' }
    ]);
  });
});

describe('nested objects', () => {
  describe('singly nested object', () => {
    // renaming metadata/basic/title to metadata/basic/name. a more sugary syntax:
    // in("metadata", rename("title", "name", "string"))
    const lensSource: LensSource = [inside('metadata', [renameProperty('title', 'name')])];

    const docSchema = {
      $schema: 'http://json-schema.org/draft-07/schema',
      type: 'object' as const,
      additionalProperties: false,
      properties: {
        metadata: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const }
          }
        },
        otherparent: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const, default: '' }
          }
        }
      }
    };

    it('renames a field correctly', () => {
      const setDescription: Patch = [
        {
          op: 'replace' as const,
          path: '/metadata/title',
          value: 'hello'
        }
      ];

      expect(applyLensToPatch(lensSource, setDescription, docSchema)).toEqual([
        { op: 'replace' as const, path: '/metadata/name', value: 'hello' }
      ]);
    });

    it('works with whole doc conversion', () => {
      expect(applyLensToDoc(lensSource, { metadata: { title: 'hello' } }, docSchema)).toEqual({
        metadata: { name: 'hello' },
        otherparent: { title: '' }
      });
    });

    it("doesn't rename another field", () => {
      const randomPatch: Patch = [
        {
          op: 'replace' as const,
          path: '/otherparent/title',
          value: 'hello'
        }
      ];

      expect(applyLensToPatch(lensSource, randomPatch, docSchema)).toEqual(randomPatch);
    });

    it('renames a field in the left direction', () => {
      const setDescription: Patch = [
        {
          op: 'replace' as const,
          path: '/metadata/name',
          value: 'hello'
        }
      ];

      const updatedSchema = updateSchema(docSchema, lensSource);

      expect(applyLensToPatch(reverseLens(lensSource), setDescription, updatedSchema)).toEqual([
        { op: 'replace' as const, path: '/metadata/title', value: 'hello' }
      ]);
    });

    it('renames the field when a whole object is set in a patch', () => {
      const setDescription: Patch = [
        {
          op: 'replace' as const,
          path: '/metadata',
          value: { title: 'hello' }
        }
      ];

      expect(applyLensToPatch(lensSource, setDescription, docSchema)).toEqual([
        {
          op: 'replace' as const,
          path: '/metadata',
          value: {}
        },
        {
          op: 'replace' as const,
          path: '/metadata/name',
          value: 'hello'
        }
      ]);
    });
  });
});

describe('arrays', () => {
  // renaming tasks/n/title to tasks/n/name
  const lensSource: LensSource = [inside('tasks', [map([renameProperty('title', 'name')])])];

  it('renames a field in an array element', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/tasks/23/title',
            value: 'hello'
          }
        ],
        projectV1Schema
      )
    ).toEqual([{ op: 'replace' as const, path: '/tasks/23/name', value: 'hello' }]);
  });

  it('renames a field in the left direction', () => {
    expect(
      applyLensToPatch(
        reverseLens(lensSource),
        [
          {
            op: 'replace' as const,
            path: '/tasks/23/name',
            value: 'hello'
          }
        ],
        updateSchema(projectV1Schema, lensSource)
      )
    ).toEqual([{ op: 'replace' as const, path: '/tasks/23/title', value: 'hello' }]);
  });
});

describe('hoist (object)', () => {
  const lensSource: LensSource = [hoistProperty('metadata', 'createdAt')];

  it('pulls a field up to its parent', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/metadata/createdAt',
            value: 'July 7th, 2020'
          }
        ],
        projectV1Schema
      )
    ).toEqual([{ op: 'replace' as const, path: '/createdAt', value: 'July 7th, 2020' }]);
  });
});

describe('plunge (object)', () => {
  const lensSource: LensSource = [plungeProperty('metadata', 'title')];

  // currently does not pass - strange ordering issue with fields in the object
  it.skip('pushes a field into a child with applyLensToDoc', () => {
    expect(
      applyLensToDoc([{ op: 'plunge', host: 'tags', name: 'color' }], {
        // this currently throws an error but works if we re-order color and tags in the object below
        color: 'orange',
        tags: {}
      })
    ).toEqual({ tags: { color: 'orange' } });
  });

  it('pushes a field into its child', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/title',
            value: 'Fun project'
          }
        ],
        projectV1Schema
      )
    ).toEqual([{ op: 'replace' as const, path: '/metadata/title', value: 'Fun project' }]);
  });
});

describe('wrap (scalar to array)', () => {
  const docSchema: JSONSchema7 = {
    $schema: 'http://json-schema.org/draft-07/schema',
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      assignee: { type: ['string' as const, 'null' as const] }
    }
  };
  const lensSource: LensSource = [wrapProperty('assignee')];

  it('converts head replace value into 0th element writes into its child', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/assignee',
            value: 'July 7th, 2020'
          }
        ],
        docSchema
      )
    ).toEqual([{ op: 'replace' as const, path: '/assignee/0', value: 'July 7th, 2020' }]);
  });

  it('converts head add value into 0th element writes into its child', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'add' as const,
            path: '/assignee',
            value: 'July 7th, 2020'
          }
        ],
        docSchema
      )
    ).toEqual([{ op: 'add' as const, path: '/assignee/0', value: 'July 7th, 2020' }]);
  });

  // todo: many possible options for how to handle this.
  // Consider other options:
  // https://github.com/inkandswitch/cambria/blob/default/conversations/converting-scalar-to-arrays.md
  it('converts head null write into a remove the first element op', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/assignee',
            value: null
          }
        ],
        docSchema
      )
    ).toEqual([{ op: 'remove' as const, path: '/assignee/0' }]);
  });

  it('handles a wrap followed by a rename', () => {
    const lensSource: LensSource = [wrapProperty('assignee'), renameProperty('assignee', 'assignees')];

    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/assignee',
            value: 'pvh'
          }
        ],
        docSchema
      )
    ).toEqual([{ op: 'replace' as const, path: '/assignees/0', value: 'pvh' }]);
  });

  it('converts nested values into 0th element writes into its child', () => {
    const docSchema: JSONSchema7 = {
      $schema: 'http://json-schema.org/draft-07/schema',
      type: 'object' as const,
      additionalProperties: false,
      properties: {
        assignee: { type: ['object', 'null'], properties: { name: { type: 'string' } } }
      }
    };

    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/assignee/name',
            value: 'Orion'
          }
        ],
        docSchema
      )
    ).toEqual([{ op: 'replace' as const, path: '/assignee/0/name', value: 'Orion' }]);
  });

  describe('reverse direction', () => {
    // this duplicates the tests of head;
    // and is just a sanity check that the reverse isn't totally broken.
    // (could be also tested independently, but this is a nice backup)
    it('converts array first element write into a write on the scalar', () => {
      expect(
        applyLensToPatch(
          reverseLens(lensSource),
          [{ op: 'replace' as const, path: '/assignee/0', value: 'July 7th, 2020' }],
          updateSchema(docSchema, lensSource)
        )
      ).toEqual([
        {
          op: 'replace' as const,
          path: '/assignee',
          value: 'July 7th, 2020'
        }
      ]);
    });
  });
});

describe('head (array to nullable scalar)', () => {
  const docSchema = {
    $schema: 'http://json-schema.org/draft-07/schema',
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      assignee: { type: 'array', items: { type: 'string' } }
    }
  } as const;
  const lensSource: LensSource = [headProperty('assignee')];

  it('converts head set value into 0th element writes into its child', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/assignee/0',
            value: 'Peter'
          }
        ],
        docSchema
      )
    ).toEqual([{ op: 'replace' as const, path: '/assignee', value: 'Peter' }]);
  });

  it('converts a write on other elements to a no-op', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          {
            op: 'replace' as const,
            path: '/assignee/1',
            value: 'Peter'
          }
        ],
        docSchema
      )
    ).toEqual([]);
  });

  it('converts array first element delete into a null write on the scalar', () => {
    expect(applyLensToPatch(lensSource, [{ op: 'remove' as const, path: '/assignee/0' }], docSchema)).toEqual(
      [{ op: 'replace' as const, path: '/assignee', value: null }]
    );
  });

  it('preserves the rest of the path after the array index', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [{ op: 'replace' as const, path: '/assignee/0/age', value: 23 }],
        docSchema
      )
    ).toEqual([{ op: 'replace' as const, path: '/assignee/age', value: 23 }]);
  });

  it('preserves the rest of the path after the array index with nulls', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [{ op: 'replace' as const, path: '/assignee/0/age', value: null }],
        docSchema
      )
    ).toEqual([{ op: 'replace' as const, path: '/assignee/age', value: null }]);
  });

  it('preserves the rest of the path after the array index with removes', () => {
    expect(
      applyLensToPatch(lensSource, [{ op: 'remove' as const, path: '/assignee/0/age' }], docSchema)
    ).toEqual([{ op: 'remove' as const, path: '/assignee/age' }]);
  });

  it('correctly handles a sequence of array writes', () => {
    expect(
      applyLensToPatch(
        lensSource,
        [
          // set array to ['geoffrey', 'orion']
          { op: 'add' as const, path: '/assignee/0', value: 'geoffrey' },
          { op: 'add' as const, path: '/assignee/1', value: 'orion' },

          // remove geoffrey from the array
          // in our current naive json patch observer, this comes out as below.
          // (this isn't a good patch format given crdt problems, but it's convenient for now
          // because the patch itself gives us the new head value)
          { op: 'remove' as const, path: '/assignee/1' },
          { op: 'replace' as const, path: '/assignee/0', value: 'orion' }
        ],
        docSchema
      )
    ).toEqual([
      {
        op: 'add' as const,
        path: '/assignee',
        value: 'geoffrey'
      },
      {
        op: 'replace' as const,
        path: '/assignee',
        value: 'orion'
      }
    ]);
  });

  describe('reverse direction', () => {
    // this duplicates the tests of wrap;
    // and is just a sanity check that the reverse isn't totally broken.
    // (could be also tested independently, but this is a nice backup)

    const docSchema: JSONSchema7 = {
      $schema: 'http://json-schema.org/draft-07/schema',
      type: 'object' as const,
      additionalProperties: false,
      properties: {
        assignee: { type: ['string', 'null'] }
      }
    };

    it('converts head set value into 0th element writes into its child', () => {
      expect(
        applyLensToPatch(
          reverseLens(lensSource),
          [
            {
              op: 'replace' as const,
              path: '/assignee',
              value: 'July 7th, 2020'
            }
          ],
          docSchema
        )
      ).toEqual([{ op: 'replace' as const, path: '/assignee/0', value: 'July 7th, 2020' }]);
    });
  });
});

describe('patch expander', () => {
  it('expands a patch that sets an object', () => {
    const setObject: PatchOp = {
      op: 'replace' as const,
      path: '/obj',
      value: { a: { b: 5 } }
    };

    expect(expandPatch(setObject)).toEqual([
      {
        op: 'replace' as const,
        path: '/obj',
        value: {}
      },
      {
        op: 'replace' as const,
        path: '/obj/a',
        value: {}
      },
      {
        op: 'replace' as const,
        path: '/obj/a/b',
        value: 5
      }
    ]);
  });

  it('works with multiple keys', () => {
    const setObject: PatchOp = {
      op: 'replace' as const,
      path: '/obj',
      value: { a: { b: 5, c: { d: 6 } } }
    };

    expect(expandPatch(setObject)).toEqual([
      {
        op: 'replace' as const,
        path: '/obj',
        value: {}
      },
      {
        op: 'replace' as const,
        path: '/obj/a',
        value: {}
      },
      {
        op: 'replace' as const,
        path: '/obj/a/b',
        value: 5
      },
      {
        op: 'replace' as const,
        path: '/obj/a/c',
        value: {}
      },
      {
        op: 'replace' as const,
        path: '/obj/a/c/d',
        value: 6
      }
    ]);
  });

  it('expands a patch that sets an array', () => {
    const setObject: PatchOp = {
      op: 'replace' as const,
      path: '/obj',
      value: ['hello', 'world']
    };

    expect(expandPatch(setObject)).toEqual([
      {
        op: 'replace' as const,
        path: '/obj',
        value: []
      },
      {
        op: 'replace' as const,
        path: '/obj/0',
        value: 'hello'
      },
      {
        op: 'replace' as const,
        path: '/obj/1',
        value: 'world'
      }
    ]);

    // deepEqual returns true for {} === []; so we need to double check ourselves
    const op = expandPatch(setObject)[0] as ReplaceOperation<unknown>;
    expect(Array.isArray(op.value)).toBeTruthy();
  });

  it('works recursively with objects and arrays', () => {
    const setObject: PatchOp = {
      op: 'replace' as const,
      path: '',
      value: { tasks: [{ name: 'hello' }, { name: 'world' }] }
    };

    expect(expandPatch(setObject)).toEqual([
      {
        op: 'replace' as const,
        path: '',
        value: {}
      },
      {
        op: 'replace' as const,
        path: '/tasks',
        value: []
      },
      {
        op: 'replace' as const,
        path: '/tasks/0',
        value: {}
      },
      {
        op: 'replace' as const,
        path: '/tasks/0/name',
        value: 'hello'
      },
      {
        op: 'replace' as const,
        path: '/tasks/1',
        value: {}
      },
      {
        op: 'replace' as const,
        path: '/tasks/1/name',
        value: 'world'
      }
    ]);
  });
});

describe('default value initialization', () => {
  // one lens that creates objects inside of arrays and other objects
  const v1Lens: LensSource = [
    addProperty({ name: 'tags', type: 'array', items: { type: 'object' }, default: [] }),
    inside('tags', [
      map([
        addProperty({ name: 'name', type: 'string', default: '' }),
        addProperty({ name: 'color', type: 'string', default: '#ffffff' })
      ])
    ]),
    addProperty({ name: 'metadata', type: 'object', default: {} }),
    inside('metadata', [
      addProperty({ name: 'title', type: 'string', default: '' }),
      addProperty({ name: 'flags', type: 'object', default: {} }),
      inside('flags', [addProperty({ name: 'O_CREATE', type: 'boolean', default: true })])
    ]),
    addProperty({
      name: 'assignee',
      type: ['string', 'null']
    })
  ];

  const v1Schema = schemaForLens(v1Lens);

  it('fills in defaults on a patch that adds a new array item', () => {
    const patchOp: PatchOp = {
      op: 'add',
      path: '/tags/123',
      value: { name: 'bug' }
    };

    expect(applyLensToPatch([], [patchOp], v1Schema)).toEqual([
      {
        op: 'add',
        path: '/tags/123',
        value: {}
      },
      {
        op: 'add',
        path: '/tags/123/name',
        value: ''
      },
      {
        op: 'add',
        path: '/tags/123/color',
        value: '#ffffff'
      },
      {
        op: 'add',
        path: '/tags/123/name',
        value: 'bug'
      }
    ]);
  });

  it("doesn't expand a patch on an object key that already exists", () => {
    const patchOp: PatchOp = {
      op: 'add',
      path: '/tags/123/name',
      value: 'bug'
    };

    expect(applyLensToPatch([], [patchOp], v1Schema)).toEqual([patchOp]);
  });

  it('recursively fills in defaults from the root', () => {
    const patchOp: PatchOp = {
      op: 'add',
      path: '',
      value: {}
    };

    expect(applyLensToPatch([], [patchOp], v1Schema)).toEqual([
      {
        op: 'add',
        path: '',
        value: {}
      },
      {
        op: 'add',
        path: '/tags',
        value: []
      },
      {
        op: 'add',
        path: '/metadata',
        value: {}
      },
      {
        op: 'add',
        path: '/metadata/title',
        value: ''
      },
      {
        op: 'add',
        path: '/metadata/flags',
        value: {}
      },
      {
        op: 'add',
        path: '/metadata/flags/O_CREATE',
        value: true
      },
      {
        op: 'add',
        path: '/assignee',
        value: null
      }
    ]);
  });

  it('works correctly when properties are spread across multiple lenses', () => {
    const v1Tov2Lens = [
      renameProperty('tags', 'labels'),
      inside('labels', [map([addProperty({ name: 'important', type: 'boolean', default: false })])])
    ];

    const patchOp: PatchOp = {
      op: 'add',
      path: '/tags/123',
      value: { name: 'bug' }
    };

    expect(applyLensToPatch(v1Tov2Lens, [patchOp], v1Schema)).toEqual([
      {
        op: 'add',
        path: '/labels/123',
        value: {}
      },
      {
        op: 'add',
        path: '/labels/123/name',
        value: ''
      },
      {
        op: 'add',
        path: '/labels/123/color',
        value: '#ffffff'
      },
      {
        op: 'add',
        path: '/labels/123/important',
        value: false
      },
      {
        op: 'add',
        path: '/labels/123/name',
        value: 'bug'
      }
    ]);
  });
});

describe('inferring schemas from documents', () => {
  const doc = {
    name: 'hello',
    details: {
      age: 23,
      height: 64
    }
  };

  it('infers a schema when converting a doc', () => {
    const lens = [inside('details', [renameProperty('height', 'heightInches')])];

    expect(applyLensToDoc(lens, doc)).toEqual({
      ...doc,
      details: {
        age: 23,
        heightInches: 64
      }
    });
  });

  // We should do more here, but this is the bare minimum test of whether schema inference
  // is actually working at all.
  // If our lens tries to rename a nonexistent field, it should throw an error.
  it("throws if the lens doesn't match the doc's inferred schema", () => {
    const lens = [renameProperty('nonexistent', 'ghost')];
    expect(() => {
      applyLensToDoc(lens, doc);
    }).toThrow();
  });
});
