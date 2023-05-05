# Cambria

Cambria is a Javascript/Typescript library for converting JSON data between related schemas.

You specify (in YAML or JSON) a _lens_, which specifies a data transformation. Cambria lets you use this lens to convert:

- a whole document, in JSON
- an edit to a document, in [JSON Patch](http://jsonpatch.com/)
- a schema description, in [JSON Schema](https://json-schema.org/)

Lenses are bidirectional. Once you've converted a document from schema A to schema B, you can edit the document in schema B and propagate those edits _backwards through the same lens_ to schema A.

**For more background on why Cambria exists and what it can do, see the [research essay](https://www.inkandswitch.com/cambria.html).**

⚠ Cambria is still immature software, and isn't yet ready for production use

## Use cases

- Manage backwards compatibility in a JSON API
- Manage database migrations for JSON data
- Transform a JSON document into a different shape on the command line
- Combine with [cambria-automerge](https://github.com/inkandswitch/cambria-automerge) to collaborate on documents across multiple versions of [local-first software](https://www.inkandswitch.com/local-first.html)

## API Usage

Cambria is mostly intended to be used as a Typescript / Javascript library. Here's a simple example of converting an entire document.

```js
// read doc from stdin if no input specified
const input = readFileSync(program.input || 0, 'utf-8')
const doc = JSON.parse(input)

// we can (optionally) apply the contents of the changed document to a target document
const targetDoc = program.base ? JSON.parse(readFileSync(program.base, 'utf-8')) : {}

// now load a (yaml) lens definition
const lensData = readFileSync(program.lens, 'utf-8')
let lens = loadYamlLens(lensData)

// should we reverse this lens?
if (program.reverse) {
  lens = reverseLens(lens)
}

// finally, apply the lens to the document, with the schema, onto the target document!
const newDoc = applyLensToDoc(lens, doc, program.schema, targetDoc)
console.log(JSON.stringify(newDoc, null, 4))
```

## Install

If you're using npm, run `npm install cambria`. If you're using yarn, run `yarn add cambria`. Then you can import it with `require('cambria')` as in the examples (or `import * as Cambria from 'cambria'` if using ES2015 or TypeScript).

## Tests

`npm run test`
