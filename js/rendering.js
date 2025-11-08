// Shared rendering helpers to standardize repeated UI patterns
(function(){
  function getEl(selector){
    if (!selector) return null;
    if (selector[0] === '#') return document.getElementById(selector.slice(1));
    return document.querySelector(selector);
  }
  function setVisible(elOrSelector, visible){
    const el = typeof elOrSelector === 'string' ? getEl(elOrSelector) : elOrSelector;
    if (!el) return;
    el.style.display = visible ? 'block' : 'none';
    el.classList.toggle('active', !!visible);
  }
  function setActiveById(id, active){
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', !!active);
    if (!active) el.style.display = 'none';
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

