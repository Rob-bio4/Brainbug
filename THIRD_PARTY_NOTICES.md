# Third-party data, software, and model notices

BrainBug combines original application code with attributed public scientific data and optional third-party software downloaded during local setup.

## MaleCNS v1.0 connectome data

`public/mcns-data.js` contains a compact sample derived from the **MaleCNS v1.0** dataset: neuron metadata, weighted graph connections, predicted neurotransmitter labels, and simplified SWC morphology segments.

- Project and official downloads: <https://male-cns.janelia.org/>
- Dataset: `male-cns:v1.0`
- Source infrastructure: HHMI Janelia FlyEM and neuPrint
- License stated by the project: Creative Commons Attribution 4.0 International (CC BY 4.0)
- License text: <https://creativecommons.org/licenses/by/4.0/>

Please use the citation guidance published by the MaleCNS project for scientific or academic work. BrainBug's bundled sample does not replace the authoritative dataset.

## FlyWire

BrainBug credits the **FlyWire community and platform**, whose whole-brain connectomics work and visual language inspired this experiment.

- FlyWire: <https://flywire.ai/>
- FlyWire Codex: <https://codex.flywire.ai/>

FlyWire and BrainBug are independent projects. No endorsement or official affiliation is implied.

## Qwen2.5 0.5B Instruct GGUF

The optional local answer model is downloaded from the official Qwen Hugging Face repository and is not stored in this Git repository.

- Model: <https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF>
- Quantization used: `Q4_K_M`
- Model file: `qwen2.5-0.5b-instruct-q4_k_m.gguf`

Review the model card and its current license before redistribution or commercial use.

## llama.cpp

The setup scripts download a prebuilt release of llama.cpp from its official GitHub project. Those binaries are ignored by Git and remain local to the user's machine.

- Project: <https://github.com/ggml-org/llama.cpp>
- License: MIT, as stated by the upstream project

