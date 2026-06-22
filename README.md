# LocalLab

LocalLab is a frontend-only, no-code workbench for tabular machine learning. CSV parsing, preprocessing, TensorFlow.js
training, evaluation, prediction, persistence, and export all run in the browser.

```bash
npm install
npm run dev
```

Run `npm test` for unit tests and `npm run build` for a production bundle.

Dataset contents are never sent to a backend. Projects are persisted locally in IndexedDB and leave the browser only
when the user explicitly exports a model or predictions.
