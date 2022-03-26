const fs = require('fs-extra');

const chokidar = require('chokidar');
const { printSchema } = require('graphql');
const convertToGraphQL = require('@kickstartds/jsonschema2graphql').default;
const convertToNetlifyCMS = require('@kickstartds/jsonschema2netlifycms').default;
const convertToTinaCMS = require('@kickstartds/jsonschema2tinacms').default;

// TODO I hate that require / import usage is mixed here -_-
import { JSONSchema7 } from 'json-schema';

const { getSchemas } = require('./helpers');

// TODO move this to `kickstartDS` itself, should also not be a duplicate of
// original `section.schema.json` items for components
const pageSchema: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "http://frontend.ruhmesmeile.com/page.schema.json",
  title: "Page",
  description: "Abstracts a page concept into JSON schema",
  type: "object",
  required: ["id", "layout", "title", "slug"],
  properties: {
    id: {
      type: "string",
      title: "Id",
      description: "Id for the page",
      format: "id"
    },
    layout: {
      type: "string",
      title: "Layout",
      description: "Choose a layout for the page",
      default: "default"
    },
    title: {
      type: "string",
      title: "Title",
      description: "Title for the page"
    },
    description: {
      type: "string",
      title: "Description",
      description: "Description for the page"
    },
    keywords: {
      type: "string",
      title: "Keywords",
      description: "Keywords for the page"
    },
    image: {
      type: "string",
      title: "Preview Image",
      description: "Preview image for the page"
    },
    cardImage: {
      type: "string",
      title: "Card Preview Image",
      description: "Card preview image (larger, e.g. Twitter) for the page"
    },
    slug: {
      type: "string",
      title: "Slug",
      description: "URL slug for the page"
    },
    sections: {
      type: "array",
      title: "Sections",
      description: "Collection of sections to render on the page",
      items: {
        $ref: "http://frontend.ruhmesmeile.com/base/base/section.schema.json"
      }
    },
    components: {
      type: "array",
      title: "Components",
      description: "Collection of components to render on the page",
      items: {
        "anyOf": [
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/organisms/quotes-slider.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/base/atoms/link-button.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/base/atoms/button.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/base/atoms/tag-label.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/molecules/visual.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/molecules/quote.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/molecules/visual-slider.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/molecules/contact.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/molecules/storytelling.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/molecules/collapsible-box.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/molecules/count-up.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/base/molecules/content-box.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/base/molecules/headline.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/base/molecules/text-media.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/base/molecules/teaser-box.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/content/molecules/logo-tiles.schema.json"
          },
          {
            "$ref": "http://frontend.ruhmesmeile.com/base/molecules/teaser-row.schema.json"
          }
        ]
      }
    },
    updated: {
      type: "string",
      title: "Updated",
      description: "Last update date for content",
      format: "date-time"
    },
    created: {
      type: "string",
      title: "Created",
      description: "Creation date for content",
      format: "date-time"
    }
  }
};

(async () => {
  const [, , param] = process.argv;
  const pathPrefix = fs.existsSync('../dist/.gitkeep') ? '../' : ''
  const schemaGlob = `${pathPrefix}node_modules/@kickstartds/*/lib/**/*.(schema|definitions).json`;
  const customGlob = `${pathPrefix}node_modules/**/dist/**/*.(schema|definitions).json`;

  if (param === '--watch') {
    chokidar
      .watch(schemaGlob, { ignoreInitial: true })
      .on('add', convertToGraphQL)
      .on('change', convertToGraphQL)
      .on('add', convertToNetlifyCMS)
      .on('change', convertToNetlifyCMS);
  } else {
    const {
      allDefinitions,
      schemaJsons,
      schemaAnyOfs,
      customSchemaJsons,
      ajv,
    } = await getSchemas(schemaGlob, customGlob, pageSchema);

    const gql = convertToGraphQL({
      jsonSchema: [...schemaJsons, ...schemaAnyOfs, ...customSchemaJsons],
      definitions: allDefinitions,
      ajv
    });
    fs.writeFile(
      `dist/page.graphql`,
      printSchema(gql).replace(/`/g, "'")
    );

    schemaJsons.push(pageSchema);
    const netlifyAdminConfig = convertToNetlifyCMS({
      jsonSchema: schemaJsons,
      definitions: allDefinitions,
      ajv,
      configLocation: 'static/admin/config.yml'
    });
    fs.writeFile(
      `dist/config.yml`,
      netlifyAdminConfig,
    );

    const tinacmsAdminConfig = convertToTinaCMS({
      jsonSchema: schemaJsons,
      definitions: allDefinitions,
      ajv,
      configLocation: 'static/.tina/schema.json'
    });
    fs.writeFile(
      `dist/tina.json`,
      tinacmsAdminConfig,
    );
  }
})();
