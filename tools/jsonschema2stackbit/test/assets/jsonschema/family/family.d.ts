export declare const family: {
  $schema: string;
  $id: string;
  title: string;
  description: string;
  type: string;
  required: string[];
  properties: {
    _id: {
      $ref: string;
    };
    name: {
      type: string;
      description: string;
      examples: string[];
    };
    users: {
      type: string;
      description: string;
      items: {
        $ref: string;
      };
    };
    items: {
      type: string;
      description: string;
      items: {
        $ref: string;
      };
    };
  };
};
