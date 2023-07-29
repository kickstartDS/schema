export declare const user: {
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
    email: {
      $ref: string;
    };
    name: {
      type: string;
      title: string;
      description: string;
      examples: string[];
    };
    nickname: {
      type: string;
      title: string;
      description: string;
      examples: string[];
    };
    isParent: {
      type: string;
      title: string;
      description: string;
    };
    balance: {
      type: string;
      description: string;
      readonly: boolean;
    };
    logs: {
      type: string;
      title: string;
      description: string;
      items: {
        $ref: string;
      };
    };
  };
};
