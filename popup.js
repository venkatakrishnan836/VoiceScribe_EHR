const CONFIG = {
  UI: {
    UPDATE_ANIMATION_MS: 1000,
    CONFIRM_ANIMATION_MS: 1500
  },
  STORAGE: {
    KEYS: {
      TRANSCRIPT: 'v1_confirmedTranscript',
      CONFIDENCE: 'v1_transcriptConfidence',
      LABEL: 'v1_transcriptLabel'
    }
  },
  CHECKBOX_COMMANDS: {
    POSITIVE: ['check', 'checked', 'yes', 'true', 'on', 'enable', 'enabled'],
    NEGATIVE: ['uncheck', 'unchecked', 'no', 'false', 'off', 'disable', 'disabled']
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const labelList = document.getElementById('labelList');
  const refreshBtn = document.getElementById('refreshBtn');
  const showDataBtn = document.getElementById('showDataBtn');
  const storedData = document.getElementById('storedData');
  const storedDataContent = document.getElementById('storedDataContent');
  const recordingStatus = document.getElementById('recordingStatus');
  const transcriptBox = document.getElementById('transcriptBox');
  const transcriptText = document.getElementById('transcriptText');
  const transcriptStatus = document.getElementById('transcriptStatus');
  const transcriptConfidence = document.getElementById('transcriptConfidence');
  const confidenceScore = document.getElementById('confidenceScore');
  const scribeToggleBtn = document.getElementById('scribeToggleBtn');
  const scribeText = scribeToggleBtn.querySelector('.scribe-text');

  let isRecording = false;
  let isScribeActive = false;
  let currentTranscript = '';
  let isFinalTranscript = false;
  let currentLabel = null;

  const showLoading = (element, show = true) => {
    if (show) {
      element.classList.add('loading');
      element.disabled = true;
    } else {
      element.classList.remove('loading');
      element.disabled = false;
    }
  };

  const showError = (message) => {
    recordingStatus.textContent = `Error: ${message}`;
    recordingStatus.classList.add('error');
    setTimeout(() => {
      recordingStatus.classList.remove('error');
      recordingStatus.textContent = 'Click the microphone icon next to any field to record';
    }, 3000);
  };

  const getFieldTypeHint = (label) => {
    if (!label) return '';
    const labelLower = label.toLowerCase();

    if (/e-?mail/i.test(labelLower)) return '📧 Email detected';
    if (/phone|mobile|tel/i.test(labelLower)) return '📱 Phone detected';
    if (/\bname\b/i.test(labelLower)) return '👤 Name detected';
    if (/age|quantity|amount|number/i.test(labelLower)) return '🔢 Number detected';
    if (/address|street|city/i.test(labelLower)) return '🏠 Address detected';
    if (/website|url/i.test(labelLower)) return '🌐 URL detected';
    return '';
  };

  const updateTranscriptUI = (text, isFinal, confidence = null, label = null) => {
    transcriptText.textContent = text;
    transcriptText.classList.toggle('interim', !isFinal);
    transcriptStatus.textContent = isFinal ? 'Final' : 'Interim';
    transcriptStatus.classList.toggle('final', isFinal);

    if (confidence !== null) {
      confidenceScore.textContent = Math.round(confidence * 100);
      transcriptConfidence.classList.remove('hidden');
    } else {
      transcriptConfidence.classList.add('hidden');
    }

    if (label) {
      const fieldHint = getFieldTypeHint(label);
      recordingStatus.textContent = fieldHint ?
        `${fieldHint} - Recording: ${label}...` :
        `Recording for: ${label}...`;
    } else {
      recordingStatus.textContent = isRecording ? 'Recording...' : 'Recording stopped';
    }
  };

  const startRecording = async (label) => {
    if (!label) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        showError('No active tab found');
        return;
      }

      isRecording = true;
      currentLabel = label;

      recordingStatus.textContent = `Recording for: ${label}...`;
      recordingStatus.classList.add('active');
      recordingStatus.classList.remove('error');

      transcriptBox.classList.remove('hidden');
      transcriptText.textContent = '';
      transcriptStatus.textContent = 'Listening...';
      transcriptStatus.classList.remove('final');

      document.querySelectorAll('.speech-btn').forEach(btn => {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
      });

      chrome.tabs.sendMessage(tab.id, {
        action: 'startSpeechRecognition',
        label: label
      }, (response) => {
        if (chrome.runtime.lastError) {
          showError('Failed to communicate with page. Please refresh and try again.');
          stopRecording();
          return;
        }

        if (response && !response.success) {
          showError(response.error || 'Failed to start recording');
          stopRecording();
        }
      });
    } catch (error) {
      showError(error.message || 'Failed to start recording');
      isRecording = false;
      document.querySelectorAll('.speech-btn').forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
      });
    }
  };

  const stopRecording = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        isRecording = false;
        recordingStatus.textContent = 'Recording stopped';
        recordingStatus.classList.remove('active');
        return;
      }

      isRecording = false;
      recordingStatus.textContent = 'Recording stopped';
      recordingStatus.classList.remove('active');

      document.querySelectorAll('.speech-btn').forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
      });

      chrome.tabs.sendMessage(tab.id, {
        action: 'stopSpeechRecognition'
      }, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
      });
    } catch (error) {
      isRecording = false;
      document.querySelectorAll('.speech-btn').forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
      });
    }
  };


  const applyTranscript = (transcript, label) => {
    if (!transcript || !label) return;

    const labelItems = document.querySelectorAll('.label-item');
    for (const item of labelItems) {
      const labelText = item.querySelector('.label-text');
      if (labelText && labelText.textContent === label) {
        const input = item.querySelector('input');
        if (input) {
          if (input.type === 'checkbox') {
            const lowercaseTranscript = transcript.toLowerCase();

            if (CONFIG.CHECKBOX_COMMANDS.POSITIVE.some(cmd => lowercaseTranscript.includes(cmd))) {
              input.checked = true;
            } else if (CONFIG.CHECKBOX_COMMANDS.NEGATIVE.some(cmd => lowercaseTranscript.includes(cmd))) {
              input.checked = false;
            } else {
              input.checked = !input.checked;
            }
          } else {
            input.value = transcript;
          }

          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.classList.add('updated');
          setTimeout(() => input.classList.remove('updated'), CONFIG.UI.UPDATE_ANIMATION_MS);
        }
        break;
      }
    }

    chrome.storage.local.set({
      [CONFIG.STORAGE.KEYS.TRANSCRIPT]: transcript,
      [CONFIG.STORAGE.KEYS.CONFIDENCE]: parseFloat(confidenceScore.textContent) / 100,
      [CONFIG.STORAGE.KEYS.LABEL]: label
    }, () => {
      if (chrome.runtime.lastError) {
        showError('Failed to save data: ' + chrome.runtime.lastError.message);
        return;
      }

      transcriptStatus.textContent = 'Applied';
      transcriptStatus.classList.add('final');
      transcriptBox.classList.add('confirmed');

      document.querySelectorAll('.speech-btn').forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
      });

      isRecording = false;
      recordingStatus.textContent = 'Click the microphone icon next to any field to record';
      recordingStatus.classList.remove('active');

      setTimeout(() => {
        transcriptBox.classList.remove('confirmed');
        transcriptBox.classList.add('hidden');
        currentTranscript = '';
        isFinalTranscript = false;
        currentLabel = null;
      }, CONFIG.UI.CONFIRM_ANIMATION_MS);
    });
  };

  const createSpeechButton = (label) => {
    const button = document.createElement('button');
    button.className = 'speech-btn';
    button.innerHTML = '🎤';
    button.title = 'Click to speak value';
    button.setAttribute('aria-label', `Record voice input for ${label}`);
    button.disabled = isRecording;

    if (isRecording) {
      button.setAttribute('aria-disabled', 'true');
    }

    button.addEventListener('click', () => startRecording(label));
    return button;
  };

  const updateLabelValue = async (label, value) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        return false;
      }

      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateLabelValue',
          label,
          value
        }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(response?.success || false);
        });
      });
    } catch (error) {
      return false;
    }
  };

  const getStoredData = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        return {};
      }

      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: 'getLabelValuePairs' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(response?.pairs || {});
        });
      });
    } catch (error) {
      return {};
    }
  };

  const formatStoredData = (data) => {
    return Object.entries(data).reduce((acc, [key, value]) => {
      acc[key] = {
        value: value.value,
        confidence: value.confidence
      };
      return acc;
    }, {});
  };

  const displayStoredData = async () => {
    console.log('Display stored data clicked');

    if (storedData.classList.contains('stored-data--visible')) {
      console.log('Hiding stored data');
      storedData.classList.remove('stored-data--visible');
      const btnSpan = showDataBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = '📋';
      return;
    }

    console.log('Fetching stored data...');
    showLoading(showDataBtn);
    try {
      const data = await getStoredData();
      console.log('Retrieved data:', data);
      const formattedData = formatStoredData(data);
      console.log('Formatted data:', formattedData);

      if (Object.keys(formattedData).length === 0) {
        storedDataContent.textContent = '{}\n\n// No data stored yet. Fill some fields using voice input!';
      } else {
        storedDataContent.textContent = JSON.stringify(formattedData, null, 2);
      }

      storedData.classList.add('stored-data--visible');
      const btnSpan = showDataBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = '✖';
      console.log('Stored data displayed');
    } catch (error) {
      console.error('Error displaying stored data:', error);
      showError('Failed to load stored data');
    } finally {
      showLoading(showDataBtn, false);
    }
  };

  const handleInputChange = async (input, label) => {
    const value = input.type === 'checkbox' ? input.checked.toString() : input.value;
    const success = await updateLabelValue(label, value);

    if (!success) {
    }

    if (storedData.classList.contains('stored-data--visible')) {
      displayStoredData();
    }
  };

  const getLabels = () => {
    console.log('Refresh button clicked - getting labels');
    showLoading(refreshBtn);

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (chrome.runtime.lastError) {
        console.error('Tab query error:', chrome.runtime.lastError);
        showError('Failed to query tabs');
        showLoading(refreshBtn, false);
        return;
      }

      if (!tabs || !tabs[0]) {
        console.error('No active tab found');
        showError('No active tab found');
        showLoading(refreshBtn, false);
        return;
      }

      const tabId = tabs[0].id;
      console.log('Active tab ID:', tabId);

      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (pingResponse) => {
        if (chrome.runtime.lastError || !pingResponse) {
          showError('Content script not loaded. Please refresh the page and try again.');
          showLoading(refreshBtn, false);
          return;
        }

        chrome.tabs.sendMessage(tabId, { action: 'getLabelValuePairs' }, (response) => {
          if (chrome.runtime.lastError) {
            showError('Failed to communicate with page. Please refresh.');
            showLoading(refreshBtn, false);
            return;
          }

          if (!response || !response.success) {
            showError('Failed to extract labels');
            showLoading(refreshBtn, false);
            return;
          }

          const labelKeyValuePairs = response.pairs || {};

          if (Object.keys(labelKeyValuePairs).length > 0) {
            console.log('Found', Object.keys(labelKeyValuePairs).length, 'labels');
            const formOrderedLabels = Object.entries(labelKeyValuePairs)
              .map(([key, data]) => ({
                key,
                ...data
              }))
              .sort((a, b) => (a.domPosition || 0) - (b.domPosition || 0));
            console.log('Ordered labels:', formOrderedLabels);

            labelList.innerHTML = `
              <ul class="label-list">
                ${formOrderedLabels.map(item => {
              const isCheckbox = item.element?.type === 'checkbox';
              const inputValue = isCheckbox ?
                (item.value === 'true' || item.value === true) :
                (item.value || '');

              return `
                    <li class="label-item">
                      <div class="label-header">
                        <span class="label-text">${item.key}</span>
                        <span class="confidence-score" title="Confidence Score">
                          ${(item.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div class="input-group">
                        ${isCheckbox ?
                  `<input type="checkbox" class="form-checkbox" ${inputValue ? 'checked' : ''} aria-label="${item.key}">` :
                  `<input type="text" class="form-input" value="${inputValue}" aria-label="${item.key}">`
                }
                        <button class="speech-btn" title="Click to speak value" aria-label="Record voice input for ${item.key}">🎤</button>
                      </div>
                    </li>
                  `;
            }).join('')}
              </ul>
            `;

            const items = labelList.querySelectorAll('.label-item');
            items.forEach((item, index) => {
              const label = formOrderedLabels[index].key;
              const input = item.querySelector('input');
              const speechBtn = item.querySelector('.speech-btn');

              input.addEventListener('change', () => handleInputChange(input, label));
              input.addEventListener('input', () => handleInputChange(input, label));
              speechBtn.addEventListener('click', () => startRecording(label));

              speechBtn.disabled = isRecording;
              if (isRecording) {
                speechBtn.setAttribute('aria-disabled', 'true');
              }
            });
          } else {
            console.log('No labels found on page');
            labelList.innerHTML = '<p class="no-labels">No form labels found on this page.</p>';
          }

          console.log('Refresh complete');
          showLoading(refreshBtn, false);
        });
      });
    });
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.action === 'interimTranscript') {
        currentTranscript = request.transcript;
        currentLabel = request.label;
        isFinalTranscript = request.isFinal;

        if (currentTranscript) {
          updateTranscriptUI(
            currentTranscript,
            request.isFinal,
            request.confidence,
            currentLabel
          );

          if (request.isFinal && currentTranscript && currentLabel) {
            applyTranscript(currentTranscript, currentLabel);
          }
        }
      } else if (request.action === 'recognitionError') {
        showError(request.error || 'Speech recognition error');
        stopRecording();
        document.querySelectorAll('.speech-btn').forEach(btn => {
          btn.disabled = false;
          btn.removeAttribute('aria-disabled');
        });
      } else if (request.action === 'recordingTimeout') {
        showError(request.message || 'Recording timeout');
        stopRecording();
        document.querySelectorAll('.speech-btn').forEach(btn => {
          btn.disabled = false;
          btn.removeAttribute('aria-disabled');
        });
      }
    } catch (error) {
      document.querySelectorAll('.speech-btn').forEach(btn => {
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
      });
      isRecording = false;
    }
  });

  refreshBtn.addEventListener('click', getLabels);
  showDataBtn.addEventListener('click', displayStoredData);

  scribeToggleBtn.addEventListener('click', async () => {
    isScribeActive = !isScribeActive;

    scribeToggleBtn.classList.toggle('active', isScribeActive);
    scribeText.textContent = isScribeActive ? 'Stop Ambient Scribe' : 'Start Ambient Scribe';
    recordingStatus.textContent = isScribeActive ? 'Ambient Scribe Active: Listening to conversation...' : 'Ambient Scribe Stopped';
    recordingStatus.classList.toggle('active', isScribeActive);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: isScribeActive ? 'startAmbientScribe' : 'stopAmbientScribe'
        });
      }
    } catch (err) {
      console.error('Failed to toggle scribe:', err);
      showError('Failed to communicate with page');
      isScribeActive = !isScribeActive;
      scribeToggleBtn.classList.toggle('active', isScribeActive);
    }
  });

  refreshBtn.setAttribute('aria-label', 'Refresh form labels');
  showDataBtn.setAttribute('aria-label', 'Show stored data');

  recordingStatus.textContent = 'Click the microphone icon next to any field to record';
  getLabels();

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0]?.id) {
      try {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getScribeStatus' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response && response.isActive) {
            isScribeActive = true;
            scribeToggleBtn.classList.add('active');
            scribeText.textContent = 'Stop Ambient Scribe';
            recordingStatus.textContent = 'Ambient Scribe Active: Listening to conversation...';
            recordingStatus.classList.add('active');
          }
        });
      } catch (e) {
        console.log("Failed to sync status");
      }
    }
  });
});
