# Contributing

Thanks for helping BrainBug stay strange, honest, and useful.

## Principles

1. Preserve the scientific distinction between the MaleCNS visualization, the simplified firing simulation, and the language model.
2. Never imply that the fly connectome generated the natural-language answer.
3. Keep the default experience local and private.
4. Credit data, model, and runtime sources whenever they are changed.
5. Prefer a small, inspectable implementation over a large framework.

## Local workflow

1. Install Node.js 20 or newer.
2. Run the setup script described in `README.md`.
3. Run `npm test`.
4. Start the app with `npm start`.
5. Open <http://localhost:4173> and test a question, drag rotation, wheel zoom, and a second question.

## What to verify before a pull request

- The resting specimen is static and rendered on pure black.
- Electrical traces appear only while an answer request is pending.
- Success and failure both clear every active trace and timer.
- The real SWC coordinates and dataset attribution remain intact.
- No model binaries, API keys, credentials, or runtime DLLs are committed.
- Keyboard controls and the narrow layout still work.

## Connectome refreshes

`npm run refresh:connectome` contacts the public MaleCNS neuPrint and Google Cloud Storage endpoints. Review the generated diff carefully. A refresh can change neuron IDs, classifications, edge weights, or geometry even if the application code is unchanged.

## Reporting issues

Include your operating system, Node.js version, the exact error shown in the terminal, and whether `runtime/llama-server` and the GGUF model file exist. Do not attach private prompts, API keys, or unrelated system logs.
