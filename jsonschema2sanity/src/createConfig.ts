import { Document, ArrayOf, Body2TextProps, ObjectField, ArrayField, DefaultConfigInterface, SanityConfigMap } from './@types';

export const fromBlock = (arr: Body2TextProps) =>
  Array.isArray(arr)
    ? arr.map((t) => t.children.map((c: { text: string }) => c.text).join("")).join("")
    : "";

// TODO move to JSON Schemas
const defaultConfig: DefaultConfigInterface = {
  // TODO make configurable, like for Netlify CMS pages collection
  name: "page",
  types: [],
};

// TODO re-add icons
// TODO move to JSON Schemas
const pageDocumentConfig: Document<Record<string, any>> = {
  name: "page",
  type: "document",
  title: "Pages",
  // icon: FiFileText,
  groups: [
    {
      name: "content",
      title: "Content",
      default: true,
    },
    {
      name: "meta",
      title: "Meta",
    },
  ],
  fields: [
    {
      name: "title",
      type: "string",
      title: "Title",
      group: "meta",
    },
    {
      name: "slug",
      type: "string",
      title: "Slug",
      group: "meta",
    },
    {
      name: "hideGlobalTitle",
      type: "boolean",
      title: "Hide global Title",
      initialValue: false,
      group: "meta",
    },
    {
      name: "description",
      type: "string",
      title: "Description",
      group: "meta",
    },
    {
      name: "socialImage",
      type: "image",
      title: "Social Image",
      group: "meta",
    },
    {
      name: "sections",
      type: "array",
      title: "Sections",
      group: "content",
      of: [],
    },
  ],
  // preview: {
  //   select: {
  //     title: "title",
  //     subtitle: "slug",
  //     media: "socialImage",
  //   },
  // },
};

// TODO re-add icons
// TODO re-add __experimental_actions
// TODO re-add hidden
// TODO move to JSON Schemas
const headerDocumentConfig: Document<Record<string, any>> = {
  name: 'header',
  type: 'document',
  title: 'Header',
  // icon: FiSettings,
  __experimental_actions: [/*'create',*/ 'update', /*'delete',*/ 'publish'],
  fields: [
    {
      name: 'nav',
      type: 'object',
      title: 'Main Navigation',
      fields: [
        {
          name: 'enabled',
          type: 'boolean',
          title: 'Show Main Navigation',
        },
        {
          name: 'items',
          type: 'array',
          title: 'Navigation Items',
          of: [
            { type: 'nav-link' },
          ],
          // hidden: ({ parent }) => !parent?.enabled,
        },
      ],
    },
  ],
}

// TODO re-add icons
// TODO re-add __experimental_actions
// TODO move to JSON Schemas
const footerDocumentConfig: Document<Record<string, any>> = {
  name: 'footer',
  type: 'document',
  title: 'Footer',
  // icon: FiSettings,
  __experimental_actions: [/*'create',*/ 'update', /*'delete',*/ 'publish'],
  fields: [
    {
      name: 'nav',
      title: 'Footer Navigation',
      type: 'array',
      of: [{ type: 'nav-link' }],
    },
  ],
}

// TODO re-add icons
// TODO re-add __experimental_actions
// TODO move to JSON Schemas
const settingsDocumentConfig: Document<Record<string, any>> = {
  name: 'settings',
  type: 'document',
  title: 'Settings',
  // icon: FiSettings,
  __experimental_actions: [/*'create',*/ 'update', /*'delete',*/ 'publish'],
  groups: [
    {
      name: 'meta',
      title: 'Meta',
    },
    {
      name: 'forms',
      title: 'Forms',
    },
    {
      name: 'snippets',
      title: 'Snippets',
    },
  ],
  fields: [
    {
      name: 'description',
      type: 'string',
      title: 'Fallback Description',
      group: 'meta',
    },
    {
      name: 'keywords',
      type: 'string',
      title: 'Fallback Keywords',
      group: 'meta',
    },
    {
      name: 'author',
      type: 'string',
      title: 'Fallback Author',
      group: 'meta',
    },
    {
      name: 'socialImage',
      type: 'image',
      title: 'Fallback Social Image',
      group: 'meta',
    },
    // {
    //   name: "twitter_creator",
    //   type: "string",
    //   title: "Fallback Twitter Author Account",
    //   group: "meta",
    // },
    // {
    //   name: "twitter_site",
    //   type: "string",
    //   title: "Twitter Site Account",
    //   group: "meta",
    // },
    {
      name: 'title',
      type: 'string',
      title: 'Title',
    },
    {
      name: 'titlePrefix',
      type: 'boolean',
      title: 'Show global title before page title',
    },
    {
      name: 'titleSeparator',
      type: 'string',
      title: 'Title Separator',
    },
    {
      name: 'headHtml',
      type: 'code',
      group: 'snippets',
      title: 'HTML Snippets in head',
      options: {
        language: 'html',
      },
    },
    {
      name: 'bodyHtml',
      type: 'code',
      group: 'snippets',
      title: 'HTML Snippets in body',
      options: {
        language: 'html',
      },
    },
  ],
}

// TODO re-add liveEdit
// TODO move to JSON Schemas
const productionDocumentConfig: Document<Record<string, any>> = {
  type: "document",
  name: "production",
  title: "Production Documents",
  fields: [
    {
      name: "documentId",
      type: "string",
      title: "Document ID",
    },
    {
      name: "documentType",
      type: "string",
      title: "Document Type",
    },
    {
      name: "documentRev",
      type: "string",
      title: "Document Revision",
    },
    {
      name: "slug",
      type: "string",
      title: "Page Slug",
    },
    {
      name: "data",
      type: "text",
      title: "Document Data",
    },
  ],
  // liveEdit: true,
  preview: {
    select: {
      id: "documentId",
      slug: "slug",
      type: "documentType",
    },
    // prepare({ id, slug, type }) {
    //   return {
    //     title: slug || id,
    //     subtitle: type,
    //   };
    // },
  },
}

// TODO correct parameter documentation
export function createConfig(
    sanityComponents: ArrayOf[],
  ): SanityConfigMap {

  const contentComponents = sanityComponents.filter((sanityComponent) => {
    if (sanityComponent.type === 'object') {
      // TODO handle table in Sanity, not compatible currently:
      // `Found array member declaration of type "array"
      // - multidimensional arrays are not currently supported by Sanity`
      return (sanityComponent as ObjectField).name !== 'section' && (sanityComponent as ObjectField).name !== 'table'
    }

    return false;
  });

  const contentComponentTypes = contentComponents.map((sanityComponent) => {
    return {
      type: (sanityComponent as ObjectField).name
    };
  });

  const sectionComponent = sanityComponents.find((sanityComponent) => {
    if (sanityComponent.type === 'object') {
      return (sanityComponent as ObjectField).name === 'section'
    }

    return false;
  }) as ObjectField;

  const contentArray = sectionComponent.fields.find((field) => field.name === 'content') as ArrayField;
  contentArray.of = contentComponentTypes;

  const documentSections = pageDocumentConfig.fields.find((field) => field.name === 'sections') as ArrayField;
  documentSections.of.push(sectionComponent);

  return {
    config: defaultConfig,
    documents: [pageDocumentConfig, headerDocumentConfig, footerDocumentConfig, settingsDocumentConfig, productionDocumentConfig],
    objects: contentComponents,
  };
};
