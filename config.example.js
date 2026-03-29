/* =========================================
   Nova AI — Configuration Template
   ========================================= */

// Rename this file to 'config.js' and add your API keys.
const CONFIG = {
  openRouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      'nvidia/nemotron-nano-9b-v2:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
      'z-ai/glm-4.5-air:free',
    ],
    apiKey: 'YOUR_OPENROUTER_API_KEY_HERE',
  },
  huggingFace: {
    url: 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
    apiKey: 'YOUR_HUGGINGFACE_API_KEY_HERE',
  },
};
