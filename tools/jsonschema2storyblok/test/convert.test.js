import { GraphQLObjectType, printSchema } from 'graphql';
import convert from '../src';
import { approval } from './assets/jsonschema/family/approval';
import { email } from './assets/jsonschema/family/email';
import { family } from './assets/jsonschema/family/family';
import { item } from './assets/jsonschema/family/item';
import { log } from './assets/jsonschema/family/log';
import { objectId } from './assets/jsonschema/family/objectId';
import { timeRange } from './assets/jsonschema/family/timeRange';
import { user } from './assets/jsonschema/family/user';
import { valueRange } from './assets/jsonschema/family/valueRange';
import { readAsset } from './utils/assets';
// Helpers
const testConversion = (jsonSchema, schemaText) => {
  const schema = convert({ jsonSchema });
  const actualSchemaText = printSchema(schema);
  expect(actualSchemaText).toEqualIgnoringWhitespace(schemaText);
};
function getDefinition(typeName, s) {
  const queryBlockRegex = new RegExp(`type ${typeName} \\{(\\S|\\s)*?\\}`);
  const queryBlockMatches = s.match(queryBlockRegex);
  if (queryBlockMatches) return queryBlockMatches[0];
  else return undefined;
}
// Tests
it('correctly converts basic attribute types', () => {
  const jsonSchema = {
    $id: 'Person',
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'integer' },
      score: { type: 'number' },
      isMyFriend: { type: 'boolean' }
    }
  };
  const expectedSchemaText = `
    type Person {
      name: String
      age: Int
      score: Float 
      isMyFriend: Boolean
    }
    type Query {
      people: [Person]
    }
  `;
  testConversion(jsonSchema, expectedSchemaText);
});
it('converts a literal object', () => {
  expect.assertions(1);
  const jsonSchema = {
    $id: '#/person',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      },
      age: {
        type: 'integer'
      }
    }
  };
  const expectedSchemaText = `
    type Person {
      name: String
      age: Int
    }
    type Query {
      people: [Person]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
it('converts a text schema', () => {
  expect.assertions(1);
  const jsonSchema = `{
    "$id": "person",
    "type": "object",
    "properties": {
      "name": {
        "type": "string"
      },
      "age": {
        "type": "integer"
      }
    }
  }`;
  const expectedSchemaText = `
    type Person {
      name: String
      age: Int
    }
    type Query {
      people: [Person]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
it('fails on unknown types', () => {
  expect.assertions(1);
  const jsonSchema = JSON.stringify({
    $id: '#/Pizza',
    type: 'object',
    properties: {
      foo: {
        type: 'tweedledee' // <-- invalid type
      }
    }
  });
  const conversion = () => convert({ jsonSchema });
  expect(conversion).toThrowError();
});
it('converts descriptions', () => {
  expect.assertions(1);
  const jsonSchema = {
    $id: '#/person',
    type: 'object',
    description: 'An individual human being.',
    properties: {
      name: {
        type: 'string',
        description: 'The full name of the person.'
      },
      age: {
        type: 'integer',
        description: "The elapsed time (in years) since the person's birth."
      }
    }
  };
  const expectedSchemaText = `
    """
    An individual human being.
    """
    type Person {
      """
      The full name of the person.
      """
      name: String
      """
      The elapsed time (in years) since the person's birth.
      """
      age: Int
    }
    type Query {
      people: [Person]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
it('converts array type properties', () => {
  expect.assertions(1);
  const jsonSchema = {
    $id: '#/Person',
    type: 'object',
    properties: {
      name: {
        type: 'string'
      },
      luckyNumbers: {
        type: 'array',
        items: {
          type: 'integer'
        }
      },
      favoriteColors: {
        type: 'array',
        items: {
          type: 'string'
        }
      }
    }
  };
  const expectedSchemaText = `
    type Person {
      name: String
      luckyNumbers: [Int!]
      favoriteColors: [String!]
    }
    type Query {
      people: [Person]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('enforces required attributes', () => {
  const jsonSchema = {
    $id: '#/Widget',
    type: 'object',
    properties: {
      somethingRequired: { type: 'integer' },
      somethingOptional: { type: 'integer' },
      somethingElseRequired: { type: 'integer' }
    },
    required: ['somethingRequired', 'somethingElseRequired']
  };
  const expectedSchemaText = `
    type Query {
      widgets: [Widget]
    }
    type Widget {
      somethingRequired: Int!
      somethingOptional: Int
      somethingElseRequired: Int!
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('handles an object with no properties', () => {
  const jsonSchema = {
    $id: '#/EmptyVoid',
    properties: {},
    type: 'object'
  };
  const expectedSchemaText = `
    type EmptyVoid {
      _empty: String
    }
    type Query {
      emptyVoids: [EmptyVoid]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('handles a reference (using $ref)', () => {
  const orange = {
    $id: '#/Orange',
    type: 'object',
    properties: {
      color: {
        type: 'string'
      }
    }
  };
  const apple = {
    $id: '#/Apple',
    type: 'object',
    properties: {
      color: { type: 'string' },
      bestFriend: {
        $ref: '#/Orange' // <-- reference foreign type using $ref
      }
    }
  };
  const expectedSchemaText = `
    type Apple {
      color: String
      bestFriend: Orange
    }
    type Orange {
      color: String
    }
    type Query {
      oranges: [Orange]
      apples: [Apple]
    }`;
  testConversion([orange, apple], expectedSchemaText);
});
test('handles a reference in an array property', () => {
  const orange = {
    $id: '#/Orange',
    type: 'object',
    properties: {
      color: {
        type: 'string'
      }
    }
  };
  const apple = {
    $id: '#/Apple',
    type: 'object',
    properties: {
      color: { type: 'string' },
      bestFriends: {
        type: 'array',
        items: {
          $ref: '#/Orange' // <-- reference foreign type using $ref
        }
      }
    }
  };
  const expectedSchemaText = `
    type Apple {
      color: String
      bestFriends: [Orange!]
    }
    type Orange {
      color: String
    }
    type Query {
      oranges: [Orange]
      apples: [Apple]
    }`;
  testConversion([orange, apple], expectedSchemaText);
});
test('fails when given an invalid $ref', () => {
  const jsonSchema = {
    $id: '#/Apple',
    type: 'object',
    properties: {
      attribute: {
        $ref: '#/Orange'
      }
    }
  };
  const conversion = () => convert({ jsonSchema });
  expect(conversion).toThrowError();
});
test('handles self-reference', () => {
  const employee = {
    $id: '#/Employee',
    type: 'object',
    properties: {
      name: { type: 'string' },
      manager: { $ref: '#/Employee' } // <-- type refers to itself
    }
  };
  const expectedSchemaText = `
    type Employee {
      name: String
      manager: Employee
    }
    type Query {
      employees: [Employee]
    }`;
  testConversion(employee, expectedSchemaText);
});
test('handles a circular reference', () => {
  const apple = {
    $id: '#/Apple',
    type: 'object',
    properties: {
      bestFriend: {
        $ref: '#/Orange'
      }
    }
  };
  const orange = {
    $id: '#/Orange',
    type: 'object',
    properties: {
      bestFriend: {
        $ref: '#/Apple'
      }
    }
  };
  const expectedSchemaText = `
    type Apple {
      bestFriend: Orange
    }
    type Orange {
      bestFriend: Apple
    }
    type Query {
      oranges: [Orange]
      apples: [Apple]
    }`;
  testConversion([orange, apple], expectedSchemaText);
});
test('handles references to local definitions', () => {
  const jsonSchema = {
    $id: '#/Contact',
    definitions: {
      Address: {
        type: 'object',
        properties: {
          street_address: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' }
        }
      }
    },
    type: 'object',
    properties: {
      name: { type: 'string' },
      billing_address: { $ref: '#/definitions/Address' },
      shipping_address: { $ref: '#/definitions/Address' }
    }
  };
  const expectedSchemaText = `
    type Address {
      street_address: String
      city: String
      state: String
    }
    type Contact {
      name: String
      billing_address: Address
      shipping_address: Address
    }
    type Query {
      addresses: [Address]
      contacts: [Contact]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('handles enum types', () => {
  const jsonSchema = {
    $id: '#/Person',
    type: 'object',
    properties: {
      height: {
        type: 'string',
        enum: ['tall', 'average', 'short'] // <-- enum
      }
    }
  };
  const expectedSchemaText = `
    type Person {
      height: PersonHeight
    }
    enum PersonHeight {
      tall
      average
      short
    }
    type Query {
      people: [Person]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('handles enum types with invalid characters', () => {
  const jsonSchema = {
    $id: '#/Person',
    type: 'object',
    properties: {
      height: {
        type: 'string',
        enum: ['super-tall', 'average', 'really really short']
      }
    }
  };
  const expectedSchemaText = `
    type Person {
      height: PersonHeight
    }
    enum PersonHeight {
      super_tall
      average
      really_really_short
    }
    type Query {
      people: [Person]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('handles enum with comparison symbols', () => {
  const jsonSchema = {
    $id: '#/Comparator',
    type: 'object',
    properties: {
      operator: {
        type: 'string',
        enum: ['<', '<=', '>=', '>']
      }
    }
  };
  const expectedSchemaText = `
    type Comparator {
      operator: ComparatorOperator
    }
    enum ComparatorOperator {
      LT
      LTE
      GTE
      GT
    }
    type Query {
      comparators: [Comparator]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('handles enum with numeric keys', () => {
  const jsonSchema = {
    $id: '#/Person',
    type: 'object',
    properties: {
      age: {
        type: 'string',
        enum: ['1', '10', '100']
      }
    }
  };
  const expectedSchemaText = `
    type Person {
      age: PersonAge
    }
    enum PersonAge {
      VALUE_1
      VALUE_10
      VALUE_100
    }
    type Query {
      people: [Person]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('handles enum with namespace overlapping JS Object internals', () => {
  const jsonSchema = {
    $id: 'Comparator',
    type: 'object',
    properties: {
      operator: {
        type: 'string',
        enum: ['constructor', '__proto__']
      }
    }
  };
  const expectedSchemaText = `
    type Comparator {
      operator: ComparatorOperator
    }
    enum ComparatorOperator {
      constructor
      __proto__
    }
    type Query {
      comparators: [Comparator]
    }`;
  testConversion(jsonSchema, expectedSchemaText);
});
test('fails on enum for non-string properties', () => {
  const jsonSchema = {
    $id: '#/Person',
    type: 'object',
    properties: {
      age: {
        type: 'integer',
        enum: [1, 2, 3]
      }
    }
  };
  const conversion = () => convert({ jsonSchema });
  expect(conversion).toThrowError();
});
test('converts `oneOf` schemas (with if/then) to union types', () => {
  const parent = {
    $id: '#/Parent',
    type: 'object',
    properties: {
      type: { type: 'string' },
      name: { type: 'string' }
    }
  };
  const child = {
    $id: '#/Child',
    type: 'object',
    properties: {
      type: { type: 'string' },
      name: { type: 'string' },
      parent: { $ref: '#/Parent' },
      bestFriend: { $ref: '#/Person' },
      friends: {
        type: 'array',
        items: { $ref: '#/Person' }
      }
    }
  };
  const person = {
    $id: '#/Person',
    oneOf: [
      {
        if: { properties: { type: { const: 'Parent' } } },
        then: { $ref: '#/Parent' }
      },
      {
        if: { properties: { type: { const: 'Child' } } },
        then: { $ref: '#/Child' }
      }
    ]
  };
  const expectedSchemaText = `
    type Child {
      type: String
      name: String
      parent: Parent
      bestFriend: Person
      friends: [Person!]
    }
    type Parent {
      type: String
      name: String
    }
    union Person = Parent | Child
    type Query {
      parents: [Parent]
      children: [Child]
      people: [Person]
    }`;
  testConversion([parent, child, person], expectedSchemaText);
});
test('converts `oneOf` schemas to union types', () => {
  const parent = {
    $id: '#/Parent',
    type: 'object',
    properties: {
      type: { type: 'string' },
      name: { type: 'string' }
    }
  };
  const child = {
    $id: '#/Child',
    type: 'object',
    properties: {
      type: { type: 'string' },
      name: { type: 'string' },
      parent: { $ref: '#/Parent' },
      bestFriend: { $ref: '#/Person' },
      friends: {
        type: 'array',
        items: { $ref: '#/Person' }
      }
    }
  };
  const person = {
    $id: '#/Person',
    oneOf: [{ $ref: '#/Parent' }, { $ref: '#/Child' }]
  };
  const expectedSchemaText = `
    type Child {
      type: String
      name: String
      parent: Parent
      bestFriend: Person
      friends: [Person!]
    }
    type Parent {
      type: String
      name: String
    }
    union Person = Parent | Child
    type Query {
      parents: [Parent]
      children: [Child]
      people: [Person]
    }`;
  testConversion([parent, child, person], expectedSchemaText);
});
test('handles `oneOf` schemas that include anonymous types', () => {
  const thing = {
    $id: '#/Thing',
    oneOf: [
      {
        type: 'string'
      },
      {
        type: 'object',
        properties: {
          foo: {
            type: 'string'
          }
        }
      }
    ]
  };
  const expectedSchemaText = `
    type Query {
      things: [Thing]
    }
    union Thing = String | Thing1
    type Thing1 {
      foo: String
    }
  `;
  testConversion(thing, expectedSchemaText);
});
//
// Family tests
const FAMILY = [objectId, email, valueRange, timeRange, item, approval, log, user, family];
test('converts family schema', () => {
  const jsonSchema = FAMILY;
  const expectedSchemaText = readAsset('graphql/family.graphql');
  testConversion(jsonSchema, expectedSchemaText);
});
test('builds custom query and mutation blocks', () => {
  const jsonSchema = FAMILY;
  const entryPoints = (types) => {
    return {
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          family: { type: types['Family'] },
          user: {
            type: types['User'],
            args: {
              email: { type: types['Email'] }
            }
          }
        }
      }),
      mutation: new GraphQLObjectType({
        name: 'Mutation',
        fields: {
          stop: { type: types['Log'] }
        }
      })
    };
  };
  const schema = convert({ jsonSchema, entryPoints });
  const actualSchemaText = printSchema(schema);
  // Query
  const actualQueryBlock = getDefinition('Query', actualSchemaText);
  const expectedQueryBlock = `
      type Query {
        family: Family
        user(email: String): User
      }`;
  expect(actualQueryBlock).toEqualIgnoringWhitespace(expectedQueryBlock);
  // Mutation
  const actualMutationBlock = getDefinition('Mutation', actualSchemaText);
  const expectedMutationBlock = `
      type Mutation {
        stop: Log
      }`;
  expect(actualMutationBlock).toEqualIgnoringWhitespace(expectedMutationBlock);
});
