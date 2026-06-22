/// <reference lib="webworker" />
import { parseCsv } from './parseCsv';
import type { Dataset } from './datasetTypes';

type Request = { input: File | string; source: Dataset['source']; name?: string };
self.onmessage = async (event: MessageEvent<Request>) => {
  try {
    self.postMessage({type: 'progress', progress: 10, label: 'Reading and parsing'});
    const dataset = await parseCsv(event.data.input, event.data.source, event.data.name);
    self.postMessage({type: 'progress', progress: 90, label: 'Preparing preview'});
    self.postMessage({type: 'complete', dataset})
  } catch (error) {
    self.postMessage({type: 'error', message: error instanceof Error ? error.message : String(error)})
  }
};
