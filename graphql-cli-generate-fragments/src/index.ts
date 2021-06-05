#!/usr/bin/env node

import * as yargs from 'yargs';
export * from './components';
export * from './components/generate';

if (require.main === module) {
  // eslint-disable-next-line no-unused-expressions
  yargs
    .commandDir('commands')
    .demandCommand(1)
    .strict()
    .recommendCommands()
    .help()
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .argv;
}

/*
const command: {
  command: string
  describe?: string
  handler: (context: any, argv: any) => any
  builder?: CommandBuilder
} = {
  command: 'generate-fragments',
  describe: 'Generate fragments',

  builder: {
    output: {
      alias: 'o',
      describe: 'Output folder',
      type: 'string'
    },
    save: {
      alias: 's',
      describe: 'Save settings to config file',
      type: 'boolean',
      default: 'false'
    },
    // js: {
    //   describe: 'Generate fields to js',
    //   type: 'boolean',
    //   default: 'false'
    // },
    // graphql: {
    //   describe: 'Generate fragments to graphql',
    //   type: 'boolean',
    //   default: 'true'
    // },
    generator: {
      alias: 'g',
      describe: "Generate to 'js' or 'graphql'",
      type: 'string'
    },
    verbose: {
      describe: 'Show verbose output messages',
      type: 'boolean',
      default: 'false'
    }
  },

  handler: async (context: any, argv) => {
    // if (!argv.graphql && !argv.js) {
    //   argv.graphql = argv.js = true
    // }

    const generateFragments = new GenerateFragments(context, argv)
    await generateFragments.handle()
  }
}

export = command
*/