// content/ui.js
window.ScribeUI = window.ScribeUI || {};

let scribeBadge = null;

window.ScribeUI.createScribeBadge = () => {
    if (document.getElementById('scribe-badge')) return;

    const badge = document.createElement('div');
    badge.id = 'scribe-badge';
    badge.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
            <span class="scribe-dot"></span>
            <span class="scribe-status">Recorder Active</span>
        </div>
    `;

    Object.assign(badge.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        background: '#2d3748',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '30px',
        zIndex: '999999',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'none',
        transition: 'all 0.3s ease'
    });

    const style = document.createElement('style');
    style.textContent = `
        .scribe-dot {
            width: 10px;
            height: 10px;
            background-color: #f56565;
            border-radius: 50%;
            display: inline-block;
        }
        .scribe-pulse .scribe-dot {
            animation: pulse-red 1.5s infinite;
        }
        @keyframes pulse-red {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 101, 101, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(245, 101, 101, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 101, 101, 0); }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(badge);
    scribeBadge = badge;
};

window.ScribeUI.updateScribeBadge = (state, debugText = "") => {
    if (!scribeBadge) window.ScribeUI.createScribeBadge();
    if (scribeBadge) scribeBadge.style.display = 'block';

    const dot = scribeBadge ? scribeBadge.querySelector('.scribe-dot') : null;
    const text = scribeBadge ? scribeBadge.querySelector('.scribe-status') : null;
    if (!dot || !text) return;

    switch (state) {
        case 'listening':
            scribeBadge.classList.add('scribe-pulse');
            dot.style.backgroundColor = '#f56565'; // Red
            text.textContent = debugText || 'Listening...';
            break;
        case 'processing':
            scribeBadge.classList.add('scribe-pulse');
            dot.style.backgroundColor = '#ecc94b'; // Yellow
            text.textContent = debugText || 'Processing...';
            break;
        case 'active':
            scribeBadge.classList.remove('scribe-pulse');
            dot.style.backgroundColor = '#48bb78'; // Green
            text.textContent = debugText || 'Scribe Ready';
            break;
        case 'error':
            scribeBadge.classList.remove('scribe-pulse');
            dot.style.backgroundColor = '#e53e3e'; // Dark Red
            text.textContent = debugText || 'Mic Error';
            break;
        case 'inactive':
            scribeBadge.style.display = 'none';
            break;
    }
};

window.ScribeUI.getScribeBadgeStatus = () => {
    return {
        display: scribeBadge ? scribeBadge.style.display : 'none',
        text: scribeBadge ? scribeBadge.querySelector('.scribe-status')?.textContent : 'Inactive'
    };
}
