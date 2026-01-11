// content/main.js
console.log("Live Label Extractor: Main Script Initializing...");

if (window.liveLabelExtractorRunning) {
    console.log('Live Label Extractor already running');
} else {
    window.liveLabelExtractorRunning = true;

    window.labelValuePairs = window.labelValuePairs || {};

    const getAvailableFieldsMap = () => {
        const map = {};
        const pairs = window.labelValuePairs || {};
        Object.keys(pairs).forEach(key => {
            map[key] = pairs[key].value || "";
        });
        return map;
    };

    window.FormAnalyzer = window.FormAnalyzer || {};
    window.FormAnalyzer.getAvailableFieldsMap = getAvailableFieldsMap;

    window.InputSimulator = window.InputSimulator || {};

    const applyFieldUpdates = (updates) => {
        if (!updates) return;
        console.log('Applying updates:', updates);

        window.ScribeUI.updateScribeBadge('processing', 'Updating Fields...');

        let updateCount = 0;
        Object.entries(updates).forEach(([key, value]) => {
            // Normalize key
            const targetLabel = Object.keys(window.labelValuePairs).find(k => k.toLowerCase() === key.toLowerCase());
            if (targetLabel) {
                window.InputSimulator.updateLabelValue(targetLabel, value);
                updateCount++;

                // Visual highlight
                if (window.labelValuePairs[targetLabel]?.element) {
                    const el = window.labelValuePairs[targetLabel].element;
                    const originalBg = el.style.backgroundColor;
                    el.style.transition = "background-color 0.5s";
                    el.style.backgroundColor = "#e6fffa";
                    setTimeout(() => { el.style.backgroundColor = originalBg; }, 2000);
                }
            }
        });

        setTimeout(() => {
            window.ScribeUI.updateScribeBadge('active', `Updated ${updateCount} fields`);
            setTimeout(() => {
                if (window.SpeechEngine.getStatus().isAmbientMode) {
                    window.ScribeUI.updateScribeBadge('listening');
                }
            }, 2000);
        }, 500);
    };

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Message received in content script:', request.action);

        switch (request.action) {
            case 'ping':
                sendResponse({ success: true });
                return false;

            case 'getLabelValuePairs':
                const pairs = window.FormAnalyzer.extractUniversalLabels();
                sendResponse({ success: true, pairs: pairs });
                return false;

            case 'updateLabelValue':
                const success = window.InputSimulator.updateLabelValue(request.label, request.value);
                sendResponse({ success: success });
                return false;

            case 'startSpeechRecognition':
                window.SpeechEngine.start(request.label)
                    .then(res => sendResponse(res))
                    .catch(err => sendResponse({ success: false, error: err }));
                return true;

            case 'stopSpeechRecognition':
                const result = window.SpeechEngine.stop();
                sendResponse(result);
                return false;

            case 'startAmbientScribe':
                window.SpeechEngine.startAmbient()
                    .then(res => sendResponse(res))
                    .catch(err => sendResponse({ success: false, error: err }));
                return true;

            case 'stopAmbientScribe':
                window.SpeechEngine.stopAmbient();
                sendResponse({ success: true });
                return false;

            case 'applyFieldUpdates':
                applyFieldUpdates(request.updates);
                sendResponse({ success: true });
                return false;

            case 'scribeStatus':
                window.ScribeUI.updateScribeBadge(request.status, request.message);
                return false;

            case 'scribeError':
                console.error('Scribe Error:', request.error);
                window.ScribeUI.updateScribeBadge('error', request.error || 'AI Error');
                return false;

            case 'getScribeStatus':
                const status = window.SpeechEngine.getStatus();
                const uiStatus = window.ScribeUI.getScribeBadgeStatus();
                sendResponse({
                    success: true,
                    isActive: status.isAmbientMode,
                    isRecording: status.isRecording,
                    statusText: uiStatus.text
                });
                return false;
        }
    });

    try {
        const observer = new MutationObserver(() => {
            if (chrome.runtime?.id) {
                const labels = window.FormAnalyzer.extractUniversalLabels();
                if (Object.keys(labels).length > 0) {
                    chrome.runtime.sendMessage({ action: 'updateLabels', labelKeyValuePairs: labels }).catch(err => console.log('Runtime connection lost'));
                }
            }
        });

        // Initial extraction
        if (chrome.runtime?.id) {
            const labels = window.FormAnalyzer.extractUniversalLabels();
            if (Object.keys(labels).length > 0) {
                chrome.runtime.sendMessage({ action: 'updateLabels', labelKeyValuePairs: labels }).catch(err => console.log('Runtime connection lost'));
            }
        }

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden']
        });
    } catch (e) {
        console.log('Live Label Extractor: Context invalidated or initialization failed', e);
    }
}
