/* =========================================
   Nova AI — Application Logic
   ========================================= */

// ---- Safety Initialization ----
// If config.js is missing or empty, initialize global CONFIG with default URLs
if (typeof CONFIG === 'undefined') {
  window.CONFIG = {
    openRouter: { 
      url: 'https://openrouter.ai/api/v1/chat/completions', 
      models: ['nvidia/nemotron-nano-9b-v2:free', 'mistralai/mistral-7b-instruct:free'],
      apiKey: 'REPLACE_ME'
    },
    huggingFace: { 
      url: 'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
      apiKey: 'REPLACE_ME'
    }
  };
  window.CONFIG_MISSING = true;
}

// ---- State ----
let isImageMode = false;
let conversationHistory = [];
let isProcessing = false;

// ---- DOM Elements ----
const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sendBtnLabel = document.getElementById('sendBtnLabel');
const newChatBtn = document.getElementById('newChatBtn');
const imageModeBtn = document.getElementById('imageModeBtn');
const toggleIndicator = document.getElementById('toggleIndicator');
const modeLabel = document.getElementById('modeLabel');
const modeBadge = document.getElementById('modeBadge');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const clearSettingsBtn = document.getElementById('clearSettingsBtn');
const openRouterKeyInput = document.getElementById('openRouterKey');
const huggingFaceKeyInput = document.getElementById('huggingFaceKey');

// ---- Key Management ----
function getApiKey(service) {
  // 1. Try localStorage
  const localKey = localStorage.getItem(`nova_ai_${service}_key`);
  if (localKey && localKey.trim() !== '') return localKey;

  // 2. Try CONFIG object from config.js
  if (typeof CONFIG !== 'undefined' && CONFIG[service] && CONFIG[service].apiKey) {
    const configKey = CONFIG[service].apiKey;
    if (configKey && configKey !== 'REPLACE_ME' && !configKey.includes('YOUR_')) {
      return configKey;
    }
  }

  return null;
}

function hasAllKeys() {
  return !!(getApiKey('openRouter') && getApiKey('huggingFace'));
}

// ---- Utility Functions ----
function getTimestamp() {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatBotMessage(text) {
  // Convert markdown-style formatting to HTML
  let formatted = escapeHtml(text);

  // Code blocks (```)
  formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code (`)
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold (**text**)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic (*text*)
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Line breaks
  formatted = formatted.replace(/\n/g, '<br>');

  // Unordered list items
  formatted = formatted.replace(/((?:<br>|^))\s*[-•]\s+(.+?)(?=<br>|$)/g, '$1<li>$2</li>');

  // Numbered list items
  formatted = formatted.replace(/((?:<br>|^))\s*\d+\.\s+(.+?)(?=<br>|$)/g, '$1<li>$2</li>');

  return formatted;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  });
}

// ---- Message Rendering ----
function hideWelcomeScreen() {
  if (welcomeScreen) {
    welcomeScreen.style.display = 'none';
  }
}

function createMessageElement(role, content, options = {}) {
  hideWelcomeScreen();

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '✦';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (options.isError) {
    bubble.classList.add('error-bubble');
  }

  if (options.isImage && options.imageUrl) {
    const img = document.createElement('img');
    img.src = options.imageUrl;
    img.alt = options.prompt || 'Generated image';
    img.loading = 'lazy';
    bubble.appendChild(img);

    const downloadLink = document.createElement('a');
    downloadLink.className = 'download-btn';
    downloadLink.href = options.imageUrl;
    downloadLink.download = `nova-ai-${Date.now()}.png`;
    downloadLink.innerHTML = '⬇ Download Image';
    bubble.appendChild(downloadLink);
  } else if (role === 'bot') {
    bubble.innerHTML = formatBotMessage(content);
  } else {
    bubble.textContent = content;
  }

  contentDiv.appendChild(bubble);

  // Meta line (timestamp + copy)
  const meta = document.createElement('div');
  meta.className = 'message-meta';

  const time = document.createElement('span');
  time.className = 'message-time';
  time.textContent = getTimestamp();
  meta.appendChild(time);

  if (role === 'bot' && !options.isImage) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '📋 Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.innerHTML = '✓ Copied';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = '📋 Copy';
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    });
    meta.appendChild(copyBtn);
  }

  contentDiv.appendChild(meta);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  chatContainer.appendChild(messageDiv);
  scrollToBottom();

  return messageDiv;
}

function showTypingIndicator() {
  hideWelcomeScreen();

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message bot';
  messageDiv.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '✦';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = '<span></span><span></span><span></span>';

  bubble.appendChild(indicator);
  contentDiv.appendChild(bubble);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  chatContainer.appendChild(messageDiv);
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

function showImageSpinner() {
  hideWelcomeScreen();

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message bot';
  messageDiv.id = 'imageSpinner';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '✦';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const spinner = document.createElement('div');
  spinner.className = 'image-spinner';
  spinner.innerHTML = `
    <div class="spinner-ring"></div>
    <span class="spinner-text">Generating your image...</span>
  `;

  bubble.appendChild(spinner);
  contentDiv.appendChild(bubble);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  chatContainer.appendChild(messageDiv);
  scrollToBottom();
}

function removeImageSpinner() {
  const spinner = document.getElementById('imageSpinner');
  if (spinner) spinner.remove();
}

// ---- API Calls ----
async function sendChatMessage(userMessage) {
  const apiKey = getApiKey('openRouter');

  if (!apiKey) {
    createMessageElement('bot', '⚠️ **API Key Missing**: Please click the **Settings** (⚙️) icon in the sidebar and add your OpenRouter API key.', { isError: true });
    openSettings();
    setProcessing(false);
    return;
  }

  conversationHistory.push({ role: 'user', content: userMessage });
  showTypingIndicator();
  setProcessing(true);

  const models = CONFIG.openRouter.models || ['nvidia/nemotron-nano-9b-v2:free'];

  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch(CONFIG.openRouter.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.href,
          'X-Title': 'Nova AI',
        },
        body: JSON.stringify({
          model: model,
          messages: conversationHistory,
        }),
      });

      if (response.status === 429 || response.status === 404) {
        console.warn(`Model ${model} returned ${response.status}, trying next...`);
        lastError = new Error(`Model ${model} unavailable (${response.status})`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.choices && data.choices[0] && data.choices[0].message) {
        removeTypingIndicator();
        const botMessage = data.choices[0].message.content;
        conversationHistory.push({ role: 'assistant', content: botMessage });
        createMessageElement('bot', botMessage);
        setProcessing(false);
        return;
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (error) {
      lastError = error;
      console.warn(`Model ${model} failed:`, error.message);
      continue;
    }
  }

  // All models failed
  removeTypingIndicator();
  console.error('All chat models failed:', lastError);
  createMessageElement('bot', `⚠️ Something went wrong. ${lastError?.message || 'All models are currently unavailable. Please try again later.'}`, { isError: true });
  setProcessing(false);
}

async function generateImage(prompt) {
  showImageSpinner();
  setProcessing(true);

  const apiKey = getApiKey('huggingFace');

  if (!apiKey) {
    removeImageSpinner();
    createMessageElement('bot', '⚠️ **API Key Missing**: Please click the **Settings** (⚙️) icon in the sidebar and add your Hugging Face API key.', { isError: true });
    openSettings();
    setProcessing(false);
    return;
  }

  try {
    const response = await fetch(CONFIG.huggingFace.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    });

    removeImageSpinner();

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Image generation failed (status ${response.status}).`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) errorMsg = errorJson.error;
      } catch (_) { }
      throw new Error(errorMsg);
    }

    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);
    createMessageElement('bot', '', { isImage: true, imageUrl, prompt });
  } catch (error) {
    removeImageSpinner();
    console.error('Image generation error:', error);
    createMessageElement('bot', `⚠️ Image generation failed. ${error.message || 'Please try again.'}`, { isError: true });
  } finally {
    setProcessing(false);
  }
}

// ---- UI Controls ----
function setProcessing(state) {
  isProcessing = state;
  sendBtn.disabled = state;
  userInput.disabled = state;
  if (!state) {
    userInput.focus();
  }
}

function handleSend() {
  const message = userInput.value.trim();
  if (!message || isProcessing) return;

  createMessageElement('user', message);
  userInput.value = '';
  userInput.style.height = 'auto';

  if (isImageMode) {
    generateImage(message);
  } else {
    sendChatMessage(message);
  }
}

function toggleImageMode() {
  isImageMode = !isImageMode;
  imageModeBtn.classList.toggle('active', isImageMode);

  if (isImageMode) {
    modeLabel.textContent = 'Image Generation';
    modeBadge.textContent = 'Stable Diffusion XL';
    sendBtnLabel.textContent = 'Generate';
    userInput.placeholder = 'Describe the image you want to create...';
  } else {
    modeLabel.textContent = 'Chat';
    modeBadge.textContent = 'Nemotron 9B';
    sendBtnLabel.textContent = 'Send';
    userInput.placeholder = 'Type your message...';
  }
}

function handleNewChat() {
  conversationHistory = [];
  chatContainer.innerHTML = '';

  // Restore welcome screen
  const welcome = document.createElement('div');
  welcome.className = 'welcome-screen';
  welcome.id = 'welcomeScreen';
  welcome.innerHTML = `
    <div class="welcome-icon">✦</div>
    <h2>Welcome to Nova AI</h2>
    <p>Start a conversation or switch to Image Mode to generate stunning visuals.</p>
    <div class="welcome-chips">
      <button class="chip" data-prompt="Explain quantum computing in simple terms">Explain quantum computing</button>
      <button class="chip" data-prompt="Write a short poem about the ocean">Write a poem about the ocean</button>
      <button class="chip" data-prompt="What are the best productivity tips?">Productivity tips</button>
    </div>
  `;
  chatContainer.appendChild(welcome);

  // Re-attach chip listeners
  attachChipListeners();
  closeSidebar();
}

// ---- Sidebar Controls ----
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('active');
}

// ---- Auto-resize Textarea ----
function autoResize() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
}

// ---- Chip Listeners ----
function attachChipListeners() {
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        userInput.value = prompt;
        handleSend();
      }
    });
  });
}

// ---- Settings Controls ----
function openSettings() {
  // Pre-fill inputs with existing keys if they exist in localStorage
  openRouterKeyInput.value = localStorage.getItem('nova_ai_openRouter_key') || '';
  huggingFaceKeyInput.value = localStorage.getItem('nova_ai_huggingFace_key') || '';
  
  settingsModal.classList.add('active');
  closeSidebar();
}

function closeSettings() {
  settingsModal.classList.remove('active');
}

function handleClearSettings() {
  if (confirm('Are you sure you want to clear your saved API keys? This will log you out of your session.')) {
    localStorage.removeItem('nova_ai_openRouter_key');
    localStorage.removeItem('nova_ai_huggingFace_key');
    location.reload(); // Reload to reset state
  }
}

function handleSaveSettings() {
  const orKey = openRouterKeyInput.value.trim();
  const hfKey = huggingFaceKeyInput.value.trim();

  if (orKey) localStorage.setItem('nova_ai_openRouter_key', orKey);
  if (hfKey) localStorage.setItem('nova_ai_huggingFace_key', hfKey);

  closeSettings();
  
  // Show a mini feedback message
  const msg = createMessageElement('bot', '✅ **Settings Saved**: Your API keys have been updated locally. You can now start chatting!');
  setTimeout(() => msg.remove(), 5000);
}

// ---- Event Listeners ----
settingsBtn.addEventListener('click', openSettings);
settingsCloseBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', handleSaveSettings);
clearSettingsBtn.addEventListener('click', handleClearSettings);

// Close modal on outside click
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});

sendBtn.addEventListener('click', handleSend);

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

userInput.addEventListener('input', autoResize);

newChatBtn.addEventListener('click', handleNewChat);
imageModeBtn.addEventListener('click', toggleImageMode);

hamburgerBtn.addEventListener('click', openSidebar);
sidebarCloseBtn.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// ---- Initialize ----
attachChipListeners();
userInput.focus();

// Auto-open settings if keys are missing (only once at start if on Hosted environment)
setTimeout(() => {
  if (window.CONFIG_MISSING && !hasAllKeys()) {
    openSettings();
  }
}, 1000);
