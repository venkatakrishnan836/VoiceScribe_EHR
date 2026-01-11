import { GeminiService } from './gemini.js';

const gemini = new GeminiService();
let sessionHistory = "";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startScribeSession') {
        sessionHistory = "";
        console.log('Scribe Session Started');
        sendResponse({ success: true });
        return false;
    }

    if (request.action === 'processSpeechChunk') {
        chrome.tabs.sendMessage(sender.tab.id, {
            action: 'scribeStatus',
            status: 'processing',
            message: 'Thinking...'
        });

        handleSpeechChunk(request.transcript, request.availableFields, sender.tab.id);
        sendResponse({ success: true, status: 'processing' });
        return false;
    }

    if (request.action === 'stopScribeSession') {
        console.log('Scribe Session Stopped');
        sessionHistory = "";
        sendResponse({ success: true });
        return false;
    }
});

async function handleSpeechChunk(newText, availableFields, tabId) {
    if (!newText) return;

    sessionHistory += " " + newText;

    console.log('Processing chunk:', newText);
    console.log('Current History Length:', sessionHistory.length);

    try {
        const mappings = await gemini.processConversation(sessionHistory, availableFields);

        if (mappings && Object.keys(mappings).length > 0) {
            console.log('Gemini identified updates:', mappings);

            chrome.tabs.sendMessage(tabId, {
                action: 'applyFieldUpdates',
                updates: mappings
            });
        }
    } catch (error) {
        console.error('Background processing error:', error);
        chrome.tabs.sendMessage(tabId, {
            action: 'scribeError',
            error: error.message
        });
    }
}
