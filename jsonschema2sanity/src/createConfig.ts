import { Document, ArrayOf, Body2TextProps, ObjectField, ArrayField, DefaultConfigInterface, SanityConfigMap } from './@types';

export const fromBlock = (arr: Body2TextProps) =>
  Array.isArray(arr)
    ? arr.map((t) => t.children.map((c: { text: string }) => c.text).join("")).join("")
    : "";

const defaultConfig: DefaultConfigInterface = {
  // TODO make configurable, like for Netlify CMS pages collection
  name: "page",
  types: [],
};

const documentConfig: Document<Record<string, any>> = {
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

  const documentSections = documentConfig.fields.find((field) => field.name === 'sections') as ArrayField;
  documentSections.of.push(sectionComponent);

  return {
    config: defaultConfig,
    documents: [documentConfig],
    objects: contentComponents,
  };
};
