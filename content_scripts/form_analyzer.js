// content/form_analyzer.js
window.FormAnalyzer = window.FormAnalyzer || {};

window.FormAnalyzer.extractUniversalLabels = () => {
    const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    };

    const cleanLabelText = (text) => {
        if (!text) return '';
        return text
            .replace(/^\*/, '')
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[:：]$/, '')
            .trim();
    };

    const isValidLabel = (text) => {
        if (!text) return false;
        const invalidPatterns = [
            /^[0-9]+$/,
            /^[<>]+$/,
            /^[\-_]+$/,
            /submit|reset|cancel|close|clear/i,
            /^(click|tap|press|select)(\s+here)?$/i,
            /^(https?:\/\/|www\.)/i,
            /[<>{}[\]]/
        ];
        return text.length >= 2 &&
            text.length <= 100 &&
            !invalidPatterns.some(pattern => pattern.test(text));
    };

    const formElements = document.querySelectorAll('input, select, textarea');

    const labels = formElements.length ? Array.from(formElements).map(element => {
        if (!isVisible(element)) return null;

        let labelText = '';
        let confidence = 0;
        let foundLabel = null;

        const parentLabel = element.closest('label');
        if (parentLabel && isVisible(parentLabel)) {
            const elementPlaceholder = element.placeholder || '';
            let fullText = parentLabel.textContent;
            const inputs = parentLabel.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                fullText = fullText.replace(input.value || '', '');
                fullText = fullText.replace(input.placeholder || '', '');
            });
            labelText = cleanLabelText(fullText);
            if (labelText && isValidLabel(labelText)) {
                confidence = 1;
                return {
                    key: labelText,
                    value: element.value || '',
                    element: element,
                    confidence: confidence
                };
            }
        }

        const id = element.id;
        if (id) {
            foundLabel = document.querySelector(`label[for="${id}"]`);
            if (foundLabel && isVisible(foundLabel)) {
                labelText = cleanLabelText(foundLabel.textContent);
                if (labelText && isValidLabel(labelText)) {
                    confidence = 1;
                    return {
                        key: labelText,
                        value: element.value || '',
                        element: element,
                        confidence: confidence
                    };
                }
            }
        }

        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            labelText = cleanLabelText(ariaLabel);
            if (labelText && isValidLabel(labelText)) {
                confidence = 1;
                return {
                    key: labelText,
                    value: element.value || '',
                    element: element,
                    confidence: confidence
                };
            }
        }

        const ariaLabelledBy = element.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement && isVisible(labelElement)) {
                labelText = cleanLabelText(labelElement.textContent);
                if (labelText && isValidLabel(labelText)) {
                    confidence = 1;
                    return {
                        key: labelText,
                        value: element.value || '',
                        element: element,
                        confidence: confidence
                    };
                }
            }
        }

        let sibling = element.previousElementSibling || element.parentElement.previousElementSibling;
        if (sibling && isVisible(sibling)) {
            if (!sibling.querySelector('img, svg, i') || sibling.textContent.trim()) {
                labelText = cleanLabelText(sibling.textContent);
                if (labelText && isValidLabel(labelText)) {
                    confidence = 0.7;
                    return {
                        key: labelText,
                        value: element.value || '',
                        element: element,
                        confidence: confidence
                    };
                }
            }
        }

        const fieldset = element.closest('fieldset');
        if (fieldset) {
            const legend = fieldset.querySelector('legend');
            if (legend && isVisible(legend)) {
                labelText = cleanLabelText(legend.textContent);
                if (labelText && isValidLabel(labelText)) {
                    confidence = 0.9;
                    return {
                        key: labelText,
                        value: element.value || '',
                        element: element,
                        confidence: confidence
                    };
                }
            }
        }

        if (element.placeholder) {
            labelText = cleanLabelText(element.placeholder);
            if (labelText && isValidLabel(labelText)) {
                confidence = 0.5;
                return {
                    key: labelText,
                    value: element.value || '',
                    element: element,
                    confidence: confidence
                };
            }
        }

        return null;
    }).filter(Boolean) : [];

    const labelValuePairs = {};
    labels.forEach(label => {
        if (label && label.key) {
            labelValuePairs[label.key] = {
                value: label.value,
                element: label.element,
                confidence: label.confidence,
                domPosition: Array.from(document.querySelectorAll('input, select, textarea')).indexOf(label.element)
            };
        }
    });

    if (window) {
        window.labelValuePairs = labelValuePairs;
    }

    return labelValuePairs;
}

window.FormAnalyzer.detectFieldType = (label, element) => {
    if (!label && !element) return 'text';

    const labelLower = (label || '').toLowerCase();
    const type = element?.type || 'text';
    const name = (element?.name || '').toLowerCase();
    const id = (element?.id || '').toLowerCase();
    const placeholder = (element?.placeholder || '').toLowerCase();

    if (type === 'email' || /e-?mail|email address/.test(labelLower) || /e-?mail/.test(name) || /e-?mail/.test(id) || /e-?mail/.test(placeholder)) { return 'email'; }
    if (type === 'tel' || /phone|mobile|telephone|cell/.test(labelLower) || /phone|tel/.test(name) || /phone|tel/.test(id)) { return 'phone'; }
    if (/\b(first|last|full|user)\s*name|name\b/.test(labelLower) || /name/.test(name) || /name/.test(id)) { return 'name'; }
    if (/address|street|city|zip|postal/.test(labelLower)) { return 'address'; }
    if (type === 'number' || /\b(age|quantity|amount|number|count)\b/.test(labelLower)) { return 'number'; }
    if (type === 'date' || /\b(date|birthday|dob)\b/.test(labelLower)) { return 'date'; }
    if (type === 'url' || /\b(website|url|link)\b/.test(labelLower)) { return 'url'; }

    return 'text';
};
