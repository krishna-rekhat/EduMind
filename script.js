/**
 * EduMind Educational AI Chatbot - Frontend Script
 * Handles real-time async communication, markdown formatting, copy actions, and UI states.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const typingIndicator = document.getElementById('typing-indicator');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const promptChips = document.querySelectorAll('.chip');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    let toastTimer = null;
    let isGenerating = false;

    // Auto-scroll chat window to bottom smoothly
    const scrollToBottom = () => {
        chatHistory.scrollTo({
            top: chatHistory.scrollHeight,
            behavior: 'smooth'
        });
    };

    // Format current timestamp (e.g. 10:45 AM)
    const getFormattedTime = () => {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Show temporary toast notification
    const showToast = (message) => {
        if (!toast || !toastMessage) return;
        toastMessage.textContent = message;
        toast.classList.remove('hidden');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    };

    // Reliable Copy to Clipboard with fallback
    const copyToClipboard = async (text, successMsg = 'Copied to clipboard!') => {
        if (!text) return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                showToast(successMsg);
                return;
            }
        } catch (err) {
            console.warn('Navigator clipboard error, trying fallback: ', err);
        }

        // Fallback for non-secure contexts or older browsers
        try {
            const tempTextArea = document.createElement('textarea');
            tempTextArea.value = text;
            tempTextArea.style.position = 'fixed';
            tempTextArea.style.left = '-9999px';
            tempTextArea.style.top = '0';
            document.body.appendChild(tempTextArea);
            tempTextArea.focus();
            tempTextArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(tempTextArea);
            if (successful) {
                showToast(successMsg);
            } else {
                showToast('Unable to copy text.');
            }
        } catch (err) {
            console.error('Fallback copy failed: ', err);
            showToast('Copy failed.');
        }
    };

    /**
     * Robust Markdown Formatter:
     * - Protects code blocks from newline/list mangling
     * - Adds language tag support and copy code button
     * - Formats headers (###, ##, #)
     * - Formats blockquotes, ordered lists, unordered lists
     * - Formats inline code, bold, italics
     */
    const formatMarkdown = (rawText) => {
        if (!rawText) return '';

        // 1. Escape HTML entities
        let text = rawText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // 2. Extract and preserve code blocks
        const codeBlocks = [];
        text = text.replace(/```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `@@CODE_BLOCK_${codeBlocks.length}@@`;
            const cleanLang = lang ? lang.trim() : '';
            const trimmedCode = code.trim();
            codeBlocks.push({ lang: cleanLang, code: trimmedCode });
            return placeholder;
        });

        // 3. Process lines for headings, blockquotes, lists
        const lines = text.split('\n');
        const processedLines = [];
        let inUl = false;
        let inOl = false;

        const closeLists = () => {
            if (inUl) {
                processedLines.push('</ul>');
                inUl = false;
            }
            if (inOl) {
                processedLines.push('</ol>');
                inOl = false;
            }
        };

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const trimmed = line.trim();

            // Check if placeholder line
            if (trimmed.startsWith('@@CODE_BLOCK_') && trimmed.endsWith('@@')) {
                closeLists();
                processedLines.push(trimmed);
                continue;
            }

            // Headings
            if (trimmed.startsWith('### ')) {
                closeLists();
                processedLines.push(`<h4>${trimmed.substring(4)}</h4>`);
                continue;
            } else if (trimmed.startsWith('## ')) {
                closeLists();
                processedLines.push(`<h3>${trimmed.substring(3)}</h3>`);
                continue;
            } else if (trimmed.startsWith('# ')) {
                closeLists();
                processedLines.push(`<h2>${trimmed.substring(2)}</h2>`);
                continue;
            }

            // Blockquotes
            if (trimmed.startsWith('&gt; ')) {
                closeLists();
                processedLines.push(`<blockquote>${trimmed.substring(5)}</blockquote>`);
                continue;
            }

            // Unordered list item (- or *)
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                if (inOl) {
                    processedLines.push('</ol>');
                    inOl = false;
                }
                if (!inUl) {
                    processedLines.push('<ul>');
                    inUl = true;
                }
                processedLines.push(`<li>${trimmed.substring(2)}</li>`);
                continue;
            }

            // Ordered list item (e.g., 1. , 2. )
            const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
            if (olMatch) {
                if (inUl) {
                    processedLines.push('</ul>');
                    inUl = false;
                }
                if (!inOl) {
                    processedLines.push('<ol>');
                    inOl = true;
                }
                processedLines.push(`<li>${olMatch[2]}</li>`);
                continue;
            }

            // Regular line or empty line
            closeLists();
            if (trimmed === '') {
                processedLines.push('<div class="msg-spacer"></div>');
            } else {
                processedLines.push(`<p>${line}</p>`);
            }
        }
        closeLists();

        let formatted = processedLines.join('');

        // 4. Inline elements: Bold, Italic, Inline Code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/_([^_]+)_/g, '<em>$1</em>');

        // 5. Re-inject preserved code blocks with copy snippet button
        codeBlocks.forEach((item, index) => {
            const placeholder = `@@CODE_BLOCK_${index}@@`;
            const langLabel = item.lang ? `<span class="code-lang">${item.lang}</span>` : '<span class="code-lang">code</span>';
            const codeBlockHtml = `
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        ${langLabel}
                        <button type="button" class="btn-copy-code" data-code="${encodeURIComponent(item.code)}" title="Copy code">
                            <i class="fa-regular fa-copy"></i> Copy code
                        </button>
                    </div>
                    <pre><code class="language-${item.lang}">${item.code}</code></pre>
                </div>
            `;
            formatted = formatted.replace(placeholder, codeBlockHtml);
        });

        return formatted;
    };

    // Attach delegated click event for code block copy buttons
    chatHistory.addEventListener('click', (e) => {
        const copyCodeBtn = e.target.closest('.btn-copy-code');
        if (copyCodeBtn) {
            const rawCode = decodeURIComponent(copyCodeBtn.getAttribute('data-code') || '');
            copyToClipboard(rawCode, 'Code copied to clipboard!');
        }
    });

    // Show/Hide Typing Indicator
    const setTypingState = (isTyping) => {
        isGenerating = isTyping;
        if (isTyping) {
            typingIndicator.classList.remove('hidden');
            sendBtn.disabled = true;
        } else {
            typingIndicator.classList.add('hidden');
            sendBtn.disabled = false;
        }
        scrollToBottom();
    };

    // Send query to AI backend
    const sendAIQuery = async (messageText) => {
        setTypingState(true);

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: messageText })
            });

            const data = await response.json();
            setTypingState(false);

            if (response.ok && data.status === 'success') {
                appendBotMessage(data.response, data.timestamp);
            } else {
                const errorMsg = data.message || 'An unexpected error occurred while communicating with EduMind.';
                appendBotMessage(`⚠️ **EduMind Notice:**\n${errorMsg}`);
            }

        } catch (error) {
            console.error('Fetch error:', error);
            setTypingState(false);
            appendBotMessage('⚠️ **Network Error:** Could not connect to the EduMind server. Please verify your connection or try again.');
        }
    };

    // Append user message bubble with edit & copy capabilities
    const appendUserMessage = (text, timeStr) => {
        const time = timeStr || getFormattedTime();
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper user-wrapper';
        wrapper.dataset.rawText = text;

        wrapper.innerHTML = `
            <div class="avatar user-avatar">
                <i class="fa-solid fa-user"></i>
            </div>
            <div class="message-bubble user-bubble">
                <div class="message-header">
                    <span class="sender-name">You</span>
                    <div class="header-meta">
                        <span class="message-time">${time}</span>
                    </div>
                </div>
                <div class="message-content-view">
                    <div class="message-text">${formatMarkdown(text)}</div>
                    <div class="message-actions">
                        <button type="button" class="msg-action-btn edit-btn" title="Edit this question">
                            <i class="fa-solid fa-pen-to-square"></i> Edit
                        </button>
                        <button type="button" class="msg-action-btn copy-btn" title="Copy question">
                            <i class="fa-regular fa-copy"></i> Copy
                        </button>
                    </div>
                </div>
                <div class="message-edit-view hidden">
                    <textarea class="edit-textarea" rows="2" placeholder="Edit your question..."></textarea>
                    <div class="edit-actions-row">
                        <button type="button" class="btn-cancel-edit" title="Cancel edit (Esc)">
                            <i class="fa-solid fa-xmark"></i> Cancel
                        </button>
                        <button type="button" class="btn-save-edit" title="Save and submit (Enter)">
                            <i class="fa-solid fa-check"></i> Save &amp; Submit
                        </button>
                    </div>
                </div>
            </div>
        `;

        const contentView = wrapper.querySelector('.message-content-view');
        const editView = wrapper.querySelector('.message-edit-view');
        const editTextarea = wrapper.querySelector('.edit-textarea');
        const messageTextEl = wrapper.querySelector('.message-text');
        const headerMeta = wrapper.querySelector('.header-meta');
        const editBtn = wrapper.querySelector('.edit-btn');
        const copyBtn = wrapper.querySelector('.copy-btn');
        const cancelBtn = wrapper.querySelector('.btn-cancel-edit');
        const saveBtn = wrapper.querySelector('.btn-save-edit');

        // Copy command text
        copyBtn.addEventListener('click', () => {
            copyToClipboard(wrapper.dataset.rawText, 'Question copied to clipboard!');
        });

        // Open edit mode
        const openEditMode = () => {
            if (isGenerating) {
                showToast('Please wait for the current response to finish.');
                return;
            }
            editTextarea.value = wrapper.dataset.rawText;
            contentView.classList.add('hidden');
            editView.classList.remove('hidden');
            editTextarea.style.height = 'auto';
            editTextarea.style.height = Math.max(editTextarea.scrollHeight, 60) + 'px';
            editTextarea.focus();
            editTextarea.setSelectionRange(editTextarea.value.length, editTextarea.value.length);
        };

        // Close edit mode
        const closeEditMode = () => {
            editView.classList.add('hidden');
            contentView.classList.remove('hidden');
        };

        // Save & Resubmit edited command
        const saveAndResubmit = async () => {
            if (isGenerating) {
                showToast('Please wait for the current response to finish.');
                return;
            }
            const newText = editTextarea.value.trim();
            if (!newText) {
                showToast('Question cannot be empty.');
                editTextarea.focus();
                return;
            }

            if (newText === wrapper.dataset.rawText) {
                closeEditMode();
                return;
            }

            // Update text and dataset
            wrapper.dataset.rawText = newText;
            messageTextEl.innerHTML = formatMarkdown(newText);

            // Add or ensure edited indicator
            if (!headerMeta.querySelector('.edited-badge')) {
                const badge = document.createElement('span');
                badge.className = 'edited-badge';
                badge.innerHTML = `<i class="fa-solid fa-pen"></i> edited`;
                headerMeta.appendChild(badge);
            }

            closeEditMode();

            // Clear subsequent conversation messages after this edited command
            let nextEl = wrapper.nextElementSibling;
            while (nextEl) {
                const toRemove = nextEl;
                nextEl = nextEl.nextElementSibling;
                toRemove.remove();
            }

            // Re-send query for edited command
            await sendAIQuery(newText);
        };

        editBtn.addEventListener('click', openEditMode);
        cancelBtn.addEventListener('click', closeEditMode);
        saveBtn.addEventListener('click', saveAndResubmit);

        // Auto-expand textarea on typing
        editTextarea.addEventListener('input', () => {
            editTextarea.style.height = 'auto';
            editTextarea.style.height = Math.max(editTextarea.scrollHeight, 60) + 'px';
        });

        // Keydown shortcuts inside edit textarea
        editTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeEditMode();
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveAndResubmit();
            }
        });

        chatHistory.appendChild(wrapper);
        scrollToBottom();
    };

    // Append AI Bot message bubble
    const appendBotMessage = (text, timeStr) => {
        const time = timeStr || getFormattedTime();
        const wrapper = document.createElement('div');
        wrapper.className = 'message-wrapper bot-wrapper';

        const formattedText = formatMarkdown(text);

        wrapper.innerHTML = `
            <div class="avatar bot-avatar">
                <i class="fa-solid fa-graduation-cap"></i>
            </div>
            <div class="message-bubble bot-bubble">
                <div class="message-header">
                    <span class="sender-name">EduMind Tutor</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${formattedText}</div>
                <button class="copy-btn" title="Copy response to clipboard">
                    <i class="fa-regular fa-copy"></i> Copy
                </button>
            </div>
        `;

        // Attach event listener for copy button
        const copyBtn = wrapper.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            copyToClipboard(text, 'Response copied to clipboard!');
        });

        chatHistory.appendChild(wrapper);
        scrollToBottom();
    };

    // Initialize copy button for any pre-rendered welcome message
    const initWelcomeCopyBtn = () => {
        const initialBotMsg = chatHistory.querySelector('.bot-bubble');
        if (initialBotMsg && !initialBotMsg.querySelector('.copy-btn')) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.title = 'Copy response to clipboard';
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
            const msgText = initialBotMsg.querySelector('.message-text');
            copyBtn.addEventListener('click', () => {
                const text = msgText ? msgText.innerText : 'Welcome to EduMind AI!';
                copyToClipboard(text, 'Response copied to clipboard!');
            });
            initialBotMsg.appendChild(copyBtn);
        }
    };
    initWelcomeCopyBtn();

    // Main Send Message Handler
    const handleSendMessage = async (customMessage = null) => {
        if (isGenerating) {
            showToast('Please wait for the tutor to finish responding.');
            return;
        }

        const messageText = customMessage || userInput.value.trim();
        if (!messageText) return;

        // Reset input field
        userInput.value = '';
        userInput.style.height = 'auto';

        // 1. Render User Message
        appendUserMessage(messageText);

        // 2. Send query to AI backend
        await sendAIQuery(messageText);
    };

    // Event Listener: Form submit
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSendMessage();
    });

    // Event Listener: Enter key to send (Shift+Enter for newline)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Auto-resize textarea dynamically
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
    });

    // Event Listener: Quick Suggestion Prompt Chips
    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const promptText = chip.getAttribute('data-prompt');
            if (promptText) {
                handleSendMessage(promptText);
            }
        });
    });

    // Event Listener: Clear Chat Button
    clearChatBtn.addEventListener('click', () => {
        if (isGenerating) {
            showToast('Please wait for current response to finish.');
            return;
        }

        // Clear all except initial welcome message
        chatHistory.innerHTML = `
            <div class="message-wrapper bot-wrapper">
                <div class="avatar bot-avatar">
                    <i class="fa-solid fa-graduation-cap"></i>
                </div>
                <div class="message-bubble bot-bubble">
                    <div class="message-header">
                        <span class="sender-name">EduMind Tutor</span>
                        <span class="message-time">Just now</span>
                    </div>
                    <div class="message-text">
                        <p>Chat history cleared. 🧹 How can I assist you with your academic studies and learning goals today?</p>
                    </div>
                    <button class="copy-btn" title="Copy response to clipboard">
                        <i class="fa-regular fa-copy"></i> Copy
                    </button>
                </div>
            </div>
        `;
        const newCopyBtn = chatHistory.querySelector('.copy-btn');
        if (newCopyBtn) {
            newCopyBtn.addEventListener('click', () => {
                copyToClipboard('Chat history cleared. How can I assist you with your academic studies and learning goals today?', 'Response copied to clipboard!');
            });
        }
        showToast('Chat history cleared!');
        scrollToBottom();
    });

    // Focus input on load
    userInput.focus();
});
