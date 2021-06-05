import { generateFragments } from '../components';
import { logError, logInfo } from '../utils';

export const command = 'generate';
export const desc = 'Generate GraphQL fragments'
export const builder = {}

export async function handler() {
  try {
    await generateFragments({ project: 'default', silent: false, watch: false })
    logInfo('Generation successful!')
  } catch (e) {
    logError(`Generation failed: ${e}`);
  }
} 