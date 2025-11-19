// Shared rendering helpers to standardize repeated UI patterns
(function(){
  // Constants fallback to maintain backward compatibility if not loaded
  const C = (typeof window !== 'undefined' && window.CONSTANTS) || {};
  const DISPLAY = (C.UI_SETTINGS && C.UI_SETTINGS.DISPLAY) || { BLOCK: 'block', NONE: 'none' };
  const CSS = (C.UI_SETTINGS && C.UI_SETTINGS.CSS) || { ACTIVE: 'active' };

  function getEl(selector){
    if (!selector) return null;
    if (selector[0] === '#') return document.getElementById(selector.slice(1));
    return document.querySelector(selector);
  }
  function setVisible(elOrSelector, visible){
    const el = typeof elOrSelector === 'string' ? getEl(elOrSelector) : elOrSelector;
    if (!el) return;
    el.style.display = visible ? DISPLAY.BLOCK : DISPLAY.NONE;
    el.classList.toggle(CSS.ACTIVE, !!visible);
  }
  function setActiveById(id, active){
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle(CSS.ACTIVE, !!active);
    if (!active) el.style.display = DISPLAY.NONE;
  }
  function renderHTML(elOrSelector, html){
    const el = typeof elOrSelector === 'string' ? getEl(elOrSelector) : elOrSelector;
    if (!el) return;
    el.innerHTML = String(html || '');
  }
  function replaceChildren(elOrSelector, node){
    const el = typeof elOrSelector === 'string' ? getEl(elOrSelector) : elOrSelector;
    if (!el) return;
    el.innerHTML = '';
    if (node) el.appendChild(node);
  }

  try { window.Rendering = { setVisible, setActiveById, renderHTML, replaceChildren }; } catch(_) {}
  if (typeof module !== 'undefined') {
    module.exports = { setVisible, setActiveById, renderHTML, replaceChildren };
  }
})();
