export declare const item: {
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
    icon: {
      type: string;
      examples: string[];
    };
    description: {
      type: string;
      description: string;
      examples: string[];
    };
    isTimed: {
      type: string;
      description: string;
    };
    coinValue: {
      type: string;
      description: string;
    };
    coinValueRange: {
      $ref: string;
      description: string;
    };
  };
  additionalProperties: boolean;
};
