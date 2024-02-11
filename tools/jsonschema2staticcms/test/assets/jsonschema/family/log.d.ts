export declare const log: {
  $schema: string;
  $id: string;
  type: string;
  title: string;
  description: string;
  required: string[];
  properties: {
    _id: {
      $ref: string;
    };
    item_id: {
      title: string;
      $ref: string;
    };
    coins: {
      type: string;
      title: string;
      description: string;
    };
    date: {
      type: string;
      title: string;
      description: string;
      pattern: string;
      examples: string[];
    };
    time: {
      type: string;
      title: string;
      description: string;
      examples: string[];
      pattern: string;
    };
    timeRange: {
      $ref: string;
      title: string;
      description: string;
    };
    minutes: {
      type: string;
      title: string;
      description: string;
    };
    isManualEntry: {
      type: string;
      title: string;
      description: string;
    };
    approval: {
      $ref: string;
      title: string;
      description: string;
    };
  };
};
