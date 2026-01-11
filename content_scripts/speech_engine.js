// content/speech_engine.js
console.log("Live Label Extractor: Speech Engine Loaded");
window.SpeechEngine = window.SpeechEngine || {};

let recognition = null;
let isRecording = false;
let isAmbientMode = false;
let currentLabel = null;
let currentFieldType = 'text';
let currentElement = null;
let finalTranscript = '';
let interimTranscript = '';
let silenceTimeout = null;
let isRestarting = false;
const SILENCE_DURATION = 2000;
const AMBIENT_SILENCE_DURATION = 5000;

const numberWords = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
    'hundred': 100, 'thousand': 1000, 'million': 1000000
};

const convertSpokenNumber = (text) => {
    const words = text.toLowerCase().split(/\s+/);
    let result = 0;
    let current = 0;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const num = numberWords[word];

        if (num !== undefined) {
            if (num >= 1000) {
                current = (current || 1) * num;
                result += current;
                current = 0;
            } else if (num === 100) {
                current = (current || 1) * num;
            } else {
                current += num;
            }
        }
    }

    result += current;
    return result > 0 ? result.toString() : text;
};

const commonCorrections = {
    'g mail': 'gmail', 'gee mail': 'gmail', 'yahoo mail': 'yahoo', 'hot mail': 'hotmail', 'outlook': 'outlook',
    'to': 'to', 'too': 'to', 'two': '2', 'for': 'for', 'four': '4',
    'there': 'there', 'their': 'their', "they're": "they're",
    'period': '.', 'question mark': '?', 'exclamation mark': '!', 'exclamation point': '!',
    'semicolon': ';', 'colon': ':', 'apostrophe': "'", 'quotation mark': '"', 'quote': '"',
    'open parenthesis': '(', 'close parenthesis': ')', 'open bracket': '[', 'close bracket': ']',
    'hashtag': '#', 'hash': '#', 'pound': '#', 'dollar': '$', 'dollar sign': '$',
    'percent': '%', 'ampersand': '&', 'and sign': '&', 'asterisk': '*', 'star': '*',
};

const applyCommonCorrections = (text) => {
    let result = text;
    for (const [wrong, right] of Object.entries(commonCorrections)) {
        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
        result = result.replace(regex, right);
    }
    return result;
};

const processForFieldType = (text, fieldType) => {
    if (!text) return '';
    text = applyCommonCorrections(text);

    switch (fieldType) {
        case 'email':
            return text.toLowerCase().replace(/\s+/g, '')
                .replace(/\bat\s*the\s*rate\s*/gi, '@').replace(/\bat\s*/gi, '@')
                .replace(/\bdot\s*/g, '.').replace(/underscore/g, '_').replace(/hyphen|dash/g, '-')
                .replace(/gmail\.com/gi, '@gmail.com').replace(/yahoo\.com/gi, '@yahoo.com')
                .replace(/hotmail\.com/gi, '@hotmail.com').replace(/outlook\.com/gi, '@outlook.com');
        case 'phone':
            return text.replace(/\s+/g, '').replace(/zero/gi, '0').replace(/one/gi, '1')
                .replace(/two/gi, '2').replace(/three/gi, '3').replace(/four/gi, '4')
                .replace(/five/gi, '5').replace(/six/gi, '6').replace(/seven/gi, '7')
                .replace(/eight/gi, '8').replace(/nine/gi, '9').replace(/hyphen|dash/gi, '-')
                .replace(/plus/gi, '+').replace(/[^0-9+\-]/g, '');
        case 'name':
            return text.trim().toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        case 'number':
            const converted = convertSpokenNumber(text);
            if (converted !== text) return converted;
            return text.replace(/zero/gi, '0').replace(/one/gi, '1').replace(/two/gi, '2')
                .replace(/three/gi, '3').replace(/four/gi, '4').replace(/five/gi, '5')
                .replace(/six/gi, '6').replace(/seven/gi, '7').replace(/eight/gi, '8')
                .replace(/nine/gi, '9').replace(/ten/gi, '10').replace(/[^0-9.]/g, '');
        case 'url':
            return text.toLowerCase().replace(/\s+/g, '').replace(/\bdot\s*/g, '.')
                .replace(/slash/gi, '/').replace(/colon/gi, ':').replace(/www\s+/gi, 'www.')
                .replace(/http\s+/gi, 'http://').replace(/https\s+/gi, 'https://');
        case 'address':
            return text.trim().split(' ').map((word) => {
                const lower = word.toLowerCase();
                if (['street', 'st', 'avenue', 'ave', 'road', 'rd', 'drive', 'dr', 'lane', 'ln', 'court', 'ct', 'boulevard', 'blvd', 'north', 'south', 'east', 'west', 'n', 's', 'e', 'w'].includes(lower)) {
                    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                }
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }).join(' ');
        default:
            return text.trim().replace(/^\w/, c => c.toUpperCase()).replace(/\s+/g, ' ')
                .replace(/\bat\s+the\s+rate\s+/gi, '@').replace(/\bdot\s+com\b/gi, '.com')
                .replace(/\bdot\s+/g, '.').replace(/\bcomma\s+/g, ', ').replace(/\s+([.,!?;:])/g, '$1');
    }
};

const cleanTranscript = (text, fieldType = 'text') => {
    if (!text) return '';
    return processForFieldType(text, fieldType);
};

window.safeSendMessage = (message) => {
    if (chrome.runtime?.id) {
        return chrome.runtime.sendMessage(message).catch(err => {
            console.log('Communication error (likely context invalidated):', err.message);
        });
    } else {
        console.log('Context invalidated, suppressing message:', message.action);
        return Promise.resolve();
    }
};

window.SpeechEngine.init = () => {
    if (!('webkitSpeechRecognition' in window)) {
        return { error: 'Speech recognition is not supported in your browser. Please use Chrome.' };
    }
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
        console.log('Recognition started');
        if (isAmbientMode) {
            window.ScribeUI.updateScribeBadge('listening', 'Listening...');
        }
    };

    recognition.onresult = (event) => {
        if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
        let newInterimTranscript = '';
        let newFinalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            let bestTranscript = result[0].transcript;
            let bestConfidence = result[0].confidence || 0;
            for (let j = 1; j < result.length; j++) {
                const altConfidence = result[j].confidence || 0;
                if (altConfidence > bestConfidence) {
                    bestTranscript = result[j].transcript;
                    bestConfidence = altConfidence;
                }
            }
            if (result.isFinal) { newFinalTranscript += bestTranscript + ' '; }
            else { newInterimTranscript += bestTranscript + ' '; }
        }

        newFinalTranscript = newFinalTranscript.trim();
        newInterimTranscript = newInterimTranscript.trim();

        if (newFinalTranscript) {
            const cleanedChunk = cleanTranscript(newFinalTranscript, currentFieldType);
            if (isAmbientMode) {
                console.log('Ambient Chunk Finalized:', cleanedChunk);
                window.safeSendMessage({
                    action: 'processSpeechChunk',
                    transcript: cleanedChunk,
                    availableFields: window.FormAnalyzer.getAvailableFieldsMap ? window.FormAnalyzer.getAvailableFieldsMap() : {}
                });
                finalTranscript = '';
            } else {
                if (finalTranscript && !finalTranscript.endsWith(' ')) { finalTranscript += ' '; }
                finalTranscript += cleanedChunk;
            }

            const timeoutDuration = isAmbientMode ? AMBIENT_SILENCE_DURATION : SILENCE_DURATION;
            if (silenceTimeout) clearTimeout(silenceTimeout);
            silenceTimeout = setTimeout(() => {
                if (isRecording && finalTranscript && !isAmbientMode) {
                    console.log('Stopping due to silence');
                    window.SpeechEngine.stop();
                }
            }, timeoutDuration);
        }

        if (newInterimTranscript && !newFinalTranscript) {
            interimTranscript = cleanTranscript(newInterimTranscript, currentFieldType);
        }

        const currentTranscript = isAmbientMode ? interimTranscript : (finalTranscript + (finalTranscript && interimTranscript ? ' ' : '') + interimTranscript);
        console.log('Current transcript:', currentTranscript, 'Final:', !!finalTranscript);

        if (currentLabel && window.labelValuePairs && window.labelValuePairs[currentLabel] && finalTranscript) {
            const element = window.labelValuePairs[currentLabel].element;
            if (element && element.type === 'checkbox') {
                const positiveCommands = ['check', 'checked', 'yes', 'true', 'on', 'enable', 'enabled'];
                const negativeCommands = ['uncheck', 'unchecked', 'no', 'false', 'off', 'disable', 'disabled'];
                let value;
                const lowercaseTranscript = finalTranscript.toLowerCase();
                if (positiveCommands.some(cmd => lowercaseTranscript.includes(cmd))) { value = 'true'; }
                else if (negativeCommands.some(cmd => lowercaseTranscript.includes(cmd))) { value = 'false'; }
                else { value = (!element.checked).toString(); }
                window.InputSimulator.updateLabelValue(currentLabel, value);
            } else {
                window.InputSimulator.updateLabelValue(currentLabel, finalTranscript);
            }
        }

        let avgConfidence = null;
        if (finalTranscript) {
            let totalConfidence = 0;
            let finalCount = 0;
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    totalConfidence += event.results[i][0].confidence || 0;
                    finalCount++;
                }
            }
            avgConfidence = finalCount > 0 ? totalConfidence / finalCount : 0.9;
        }

        window.safeSendMessage({
            action: 'interimTranscript',
            transcript: currentTranscript,
            label: currentLabel,
            isFinal: !!finalTranscript,
            confidence: avgConfidence
        });
    };

    recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
        let errorMessage = 'Speech recognition error';
        let shouldStop = true;
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected. Please try again.';
                shouldStop = false;
                break;
            case 'audio-capture':
                errorMessage = 'Microphone not found. Please check your microphone.';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone access denied. Please allow microphone access.';
                break;
            case 'network':
                errorMessage = 'Network error. Please check your connection.';
                shouldStop = !isAmbientMode;
                break;
            case 'aborted':
                errorMessage = 'Recording was aborted.';
                shouldStop = false;
                break;
        }
        if (shouldStop) {
            isRecording = false; currentLabel = null;
            if (window.ScribeUI && window.ScribeUI.updateScribeBadge) window.ScribeUI.updateScribeBadge('error');
            window.safeSendMessage({ action: 'recognitionError', error: errorMessage });
        } else {
            console.log(`Non-critical error: ${event.error} - ${errorMessage}`);
        }
    };

    recognition.onend = () => {
        console.log('Recognition ended. isRecording:', isRecording, 'isRestarting:', isRestarting);
        if (isRecording && !isRestarting) {
            console.log('Restarting recognition (Ambient Mode)');
            if (window.ScribeUI && window.ScribeUI.updateScribeBadge) window.ScribeUI.updateScribeBadge('processing', 'Restarting Mic...');
            isRestarting = true;
            setTimeout(() => {
                if (isRecording) {
                    try { recognition.start(); if (window.ScribeUI) window.ScribeUI.updateScribeBadge('listening'); }
                    catch (e) { console.error("Restart failed:", e); if (window.ScribeUI) window.ScribeUI.updateScribeBadge('error', 'Restart Failed'); }
                }
                isRestarting = false;
            }, 500);
        } else if (!isRecording) {
            const finalValue = finalTranscript.trim();
            if (currentLabel && finalValue && window.labelValuePairs[currentLabel]) {
                window.InputSimulator.updateLabelValue(currentLabel, finalValue);
            }
            window.safeSendMessage({
                action: 'interimTranscript',
                transcript: finalValue,
                label: currentLabel,
                isFinal: true,
                confidence: 0.9
            });
            currentLabel = null;
            if (window.ScribeUI && window.ScribeUI.updateScribeBadge) window.ScribeUI.updateScribeBadge('inactive');
        }
    };

    return { success: true };
};

window.SpeechEngine.start = (label) => {
    return new Promise((resolve, reject) => {
        if (!recognition) {
            const result = window.SpeechEngine.init();
            if (result.error) { reject(result.error); return; }
        }
        console.log('Starting recognition for label:', label);
        currentLabel = label;
        const labelPairs = window.labelValuePairs || {};
        currentElement = labelPairs[label]?.element;
        currentFieldType = window.FormAnalyzer.detectFieldType ? window.FormAnalyzer.detectFieldType(label, currentElement) : 'text';
        finalTranscript = '';
        interimTranscript = '';
        try {
            isRecording = true;
            recognition.start();
            resolve({ success: true, status: 'started' });
        } catch (error) {
            console.error('Error starting recognition:', error);
            isRecording = false;
            currentLabel = null;
            reject(error.message);
        }
    });
};

window.SpeechEngine.stop = () => {
    if (silenceTimeout) { clearTimeout(silenceTimeout); silenceTimeout = null; }
    if (recognition) {
        isRecording = false;
        const label = currentLabel;
        const transcript = cleanTranscript(finalTranscript || interimTranscript, currentFieldType);
        try { recognition.stop(); } catch (error) { console.error('Error stopping recognition:', error); }
        currentFieldType = 'text';
        currentElement = null;
        return { success: true, transcript: transcript, label: label, confidence: 0.9 };
    }
    return { success: false, error: 'Recognition not initialized' };
};

window.SpeechEngine.startAmbient = async () => {
    isAmbientMode = true;
    if (window.ScribeUI) {
        window.ScribeUI.createScribeBadge();
        window.ScribeUI.updateScribeBadge('active');
    }
    window.safeSendMessage({ action: 'startScribeSession' });
    try {
        const result = await window.SpeechEngine.start(null);
        if (window.ScribeUI) window.ScribeUI.updateScribeBadge('listening');
        return result;
    } catch (e) {
        if (window.ScribeUI) window.ScribeUI.updateScribeBadge('error');
        throw e;
    }
};

window.SpeechEngine.stopAmbient = () => {
    isAmbientMode = false;
    if (window.ScribeUI) window.ScribeUI.updateScribeBadge('inactive');
    window.SpeechEngine.stop();
    window.safeSendMessage({ action: 'stopScribeSession' });
};

window.SpeechEngine.getStatus = () => {
    return { isRecording, isAmbientMode };
};
