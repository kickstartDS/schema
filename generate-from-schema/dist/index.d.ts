declare const fs: any;
declare const glob: any;
declare const chokidar: any;
declare const printSchema: any;
declare const convertToGraphQL: any;
declare const convertToNetlifyCMS: any;
declare const Ajv: any;
declare const ajv: any;
declare const ignoredFormats: string[];
declare const pageSchema: {
    $schema: string;
    $id: string;
    title: string;
    description: string;
    type: string;
    required: string[];
    properties: {
        id: {
            type: string;
            title: string;
            description: string;
            format: string;
        };
        layout: {
            type: string;
            title: string;
            description: string;
            default: string;
        };
        title: {
            type: string;
            title: string;
            description: string;
        };
        sections: {
            type: string;
            title: string;
            description: string;
            items: {
                $ref: string;
            };
        };
    };
};
declare const addSchema: (schemaPath: string) => Promise<any>;
