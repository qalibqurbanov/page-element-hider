// Behaviour for manual-test-page.html. Kept in an external file so the same page
// style works under a strict Content-Security-Policy.

const actionCount = document.getElementById('action-count');
const bump = () => { actionCount.textContent = String(Number(actionCount.textContent) + 1); };

// 1. Anything that counts as a "page action"
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-count]')) {
    event.preventDefault();
    bump();
  }
});
document.getElementById('demo-form').addEventListener('submit', (event) => {
  event.preventDefault();
  bump();
});

// 3. Randomised id/class on every load
const widget = document.getElementById('generated-widget');
const random = Math.random().toString(36).slice(2, 8);
widget.id = `widget-${random}${Date.now() % 10000}`;
widget.className = `css-${random} Header_title__${random}`;

// 4. Dynamic insertion
const slot = document.getElementById('dynamic-slot');
const makeAd = () => {
  const ad = document.createElement('div');
  ad.className = 'dynamic-ad';
  ad.setAttribute('data-testid', 'dynamic-ad');
  ad.textContent = 'Dynamically inserted banner';
  return ad;
};
document.getElementById('add-ad').addEventListener('click', () => slot.append(makeAd()));
document.getElementById('toggle-ad').addEventListener('click', () => {
  const existing = slot.querySelector('.dynamic-ad');
  if (existing) existing.remove();
  else slot.append(makeAd());
});
setTimeout(() => slot.append(makeAd()), 800); // also arrives "late" on its own

// 5. Fake SPA router
const view = document.getElementById('spa-view');
const pathLabel = document.getElementById('spa-path');
function renderRoute() {
  pathLabel.textContent = location.pathname;
  view.replaceChildren();
  const banner = document.createElement('div');
  banner.className = 'spa-banner';
  banner.textContent = `Route banner for ${location.pathname}`;
  view.append(banner);
}
for (const button of document.querySelectorAll('[data-route]')) {
  button.addEventListener('click', () => {
    history.pushState({}, '', button.dataset.route);
    renderRoute();
  });
}
window.addEventListener('popstate', renderRoute);
renderRoute();

// 6. Shadow DOM
class ShadowWidget extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>.shadow-ad{padding:12px;background:#ede9fe;border:1px solid #7c3aed}</style>
      <div class="shadow-ad">Ad inside an open shadow root <button>Shadow button</button></div>`;
  }
}
class ClosedWidget extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: 'closed' });
    root.innerHTML = '<div style="padding:12px;background:#f3f4f6;border:1px solid #9ca3af">Closed shadow root content</div>';
  }
}
customElements.define('shadow-widget', ShadowWidget);
customElements.define('closed-widget', ClosedWidget);

// 7. Cross-origin iframe: swap localhost <-> 127.0.0.1 so the origin differs
const crossHost = location.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
document.getElementById('frame-cross').src = `${location.protocol}//${crossHost}:${location.port}${location.pathname.replace(/[^/]*$/, '')}frame.html`;
