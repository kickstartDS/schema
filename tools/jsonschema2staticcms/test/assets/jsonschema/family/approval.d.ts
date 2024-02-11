export declare const approval: {
  $schema: string;
  $id: string;
  title: string;
  type: string;
  description: string;
  required: string[];
  properties: {
    user_id: {
      description: string;
      $ref: string;
    };
    timeStamp: {
      type: string;
      description: string;
      examples: string[];
      pattern: string;
    };
    approved: {
      type: string;
      description: string;
    };
  };
};
