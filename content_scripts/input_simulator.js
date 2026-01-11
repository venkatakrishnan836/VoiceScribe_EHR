// content/input_simulator.js

window.InputSimulator = window.InputSimulator || {};

window.InputSimulator.simulateUserInput = (element, value) => {
    if (!element) return false;

    try { element.focus(); } catch (e) { }

    switch (element.type) {
        case 'checkbox':
        case 'radio':
            let checked;
            if (typeof value === 'boolean') {
                checked = value;
            } else if (typeof value === 'string') {
                value = value.toLowerCase().trim();
                checked = value === 'true' || value === 'yes' || value === 'on' || value === 'check' || value === 'checked';
            } else {
                checked = Boolean(value);
            }

            if (element.checked !== checked) {
                element.checked = checked;
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                element.dispatchEvent(clickEvent);
            }
            break;

        case 'select-one':
            element.value = value;
            break;

        default:
            element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    try { element.blur(); } catch (e) { }

    return true;
};

window.InputSimulator.updateLabelValue = (label, value) => {
    console.log('Updating label:', label, 'with value:', value);
    const labelValuePairs = window.labelValuePairs || {};

    if (labelValuePairs[label]) {
        labelValuePairs[label].value = value;
        return window.InputSimulator.simulateUserInput(labelValuePairs[label].element, value);
    }
    return false;
};
