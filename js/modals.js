// Centralized modal controller with stacking, z-index, keyboard handling, and a11y integration
// Exports ModalController and ModalStack for testing in Node environments

(function(){
  const C = (typeof window !== 'undefined' && window.CONSTANTS) || {};
  const DISPLAY = (C.UI_SETTINGS && C.UI_SETTINGS.DISPLAY) || { BLOCK: 'block', NONE: 'none' };
  const CSS = (C.UI_SETTINGS && C.UI_SETTINGS.CSS) || { ACTIVE: 'active' };
  const BASE_BACKDROP_Z = 1000;
  const BASE_MODAL_Z = 1010;
  const Z_STEP = 20; // gap between stacked layers
  const modalRegistry = new Map(); // id -> config for reusable defaults

  class ModalStack {
    constructor(){
      this.stack = []; // [{ id, zIndexBackdrop, zIndexModal }]
    }
    depth(){ return this.stack.length; }
    top(){ return this.stack[this.stack.length - 1] || null; }
    has(id){ return this.stack.some(m => m.id === id); }
    push(id){
      if (this.has(id)) return this.top();
      const idx = this.depth();
      const entry = {
        id,
        zIndexBackdrop: BASE_BACKDROP_Z + idx * Z_STEP,
        zIndexModal: BASE_MODAL_Z + idx * Z_STEP,
      };
      this.stack.push(entry);
      return entry;
    }
    pop(){
      return this.stack.pop() || null;
    }
    remove(id){
      const i = this.stack.findIndex(m => m.id === id);
      if (i >= 0) {
        const [removed] = this.stack.splice(i, 1);
        // Recompute z-indices for remaining entries
        this.stack.forEach((m, idx) => {
          m.zIndexBackdrop = BASE_BACKDROP_Z + idx * Z_STEP;
          m.zIndexModal = BASE_MODAL_Z + idx * Z_STEP;
        });
        return removed;
      }
      return null;
    }
    computeZForIndex(index){
      return {
        backdrop: BASE_BACKDROP_Z + index * Z_STEP,
        modal: BASE_MODAL_Z + index * Z_STEP,
      };
    }
    handleEscape(){
      // For testing: simulate Escape closing the topmost
      const top = this.top();
      if (!top) return null;
      this.pop();
      // Recompute remaining z-indices
      this.stack.forEach((m, idx) => {
        m.zIndexBackdrop = BASE_BACKDROP_Z + idx * Z_STEP;
        m.zIndexModal = BASE_MODAL_Z + idx * Z_STEP;
      });
      return top.id;
    }
  }

  class ModalController {
    constructor(){
      this.stack = new ModalStack();
      this._keyHandler = (e) => {
        if (e && e.key === 'Escape' && this.stack.depth() > 0) {
          this.closeTop();
        }
      };
      if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
        document.addEventListener('keydown', this._keyHandler);
      }
      this._bodyClassApplied = false;
    }

    // Register reusable defaults and semantics for a modal id
    register(id, config = {}){
      if (!id) return;
      modalRegistry.set(String(id), Object.assign({}, config));
    }
    getConfig(id){
      return modalRegistry.get(String(id)) || {};
    }

    // Create a reusable modal element with standard structure and ARIA
    create({ id, title = '', content, closeLabel = 'Close', className = 'sa-modal', describedBy, labelledBy, focusFirst, attributes = {} } = {}){
      if (!id) throw new Error('ModalController.create requires an id');
      if (typeof document === 'undefined') return null;
      const existing = document.getElementById(id);
      if (existing) return existing;

      const wrapper = document.createElement('div');
      wrapper.id = id;
      wrapper.className = className + ' sa-modal-background';
    wrapper.style.display = DISPLAY.NONE;
      wrapper.setAttribute('role', 'dialog');
      wrapper.setAttribute('aria-modal', 'true');
      const titleId = labelledBy || (id + 'Title');
      const descId = describedBy || (id + 'Desc');
      wrapper.setAttribute('aria-labelledby', titleId);
      wrapper.setAttribute('aria-describedby', descId);
      Object.entries(attributes || {}).forEach(([k,v]) => {
        try { wrapper.setAttribute(k, String(v)); } catch(_) {}
      });

      const panel = document.createElement('div');
      panel.className = 'sa-modal-panel';
      panel.innerHTML = `
        <div class="sa-modal-header">
          <h3 id="${titleId}" class="sa-modal-title">${title}</h3>
          <button type="button" class="sa-modal-close" aria-label="${closeLabel}">&times;</button>
        </div>
        <div class="sa-modal-body" id="${descId}"></div>
        <div class="sa-modal-footer"></div>
      `;
      wrapper.appendChild(panel);
      document.body.appendChild(wrapper);

      const body = panel.querySelector('.sa-modal-body');
      if (body) {
        if (typeof content === 'string') body.innerHTML = content;
        else if (content instanceof Node) body.appendChild(content);
      }
      const closeBtn = panel.querySelector('.sa-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', () => this.closeById(id));

      // Register defaults for this modal
      this.register(id, { labelledBy: titleId, describedBy: descId, focusFirst });
      return wrapper;
    }

    openById(id, options = {}){
      const modal = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if (!modal) {
        console.warn('[ModalController] Modal not found:', id);
        return;
      }
      const defaults = this.getConfig(id);
      const opts = Object.assign({}, defaults, options);
      if (this.stack.has(id)) {
        // Already tracked; bring to top by removing and re-pushing
        this.stack.remove(id);
      }
      const entry = this.stack.push(id);

      // Visuals: backdrop per modal for strict stacking
      const backdrop = null;

      // Modal visuals and semantics
      modal.style.zIndex = String(entry.zIndexModal);
      // Use flex centering for app overlay modals
      if (modal.classList.contains('justification-modal') || modal.classList.contains('help-modal') || modal.classList.contains('reevaluate-modal')) {
        modal.style.display = 'flex';
        try {
          modal.style.position = 'fixed';
          modal.style.top = '0';
          modal.style.left = '0';
          modal.style.width = '100%';
          modal.style.height = '100%';
          modal.style.alignItems = 'center';
          modal.style.justifyContent = 'center';
        } catch (_) {}
      } else {
        modal.style.display = DISPLAY.BLOCK;
      }
      modal.classList.add(CSS.ACTIVE);
      modal.classList.remove('sa-modal-background');
      modal.setAttribute('aria-hidden', 'false');
      modal.setAttribute('role', modal.getAttribute('role') || 'dialog');
      modal.setAttribute('aria-modal', 'true');

      // Focus management via A11y helper if available
      try {
        if (typeof window !== 'undefined' && window.A11y && typeof window.A11y.openDialog === 'function') {
          const { labelledBy, describedBy, focusFirst } = opts;
          window.A11y.openDialog(modal, { labelledBy, describedBy, focusFirst });
        } else if (typeof modal.focus === 'function') {
          // Fallback: focus first focusable
          const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (focusable) focusable.focus();
        }
      } catch (_) {}

      // Backdrop click-to-close if enabled
      const closeOnBackdrop = opts.closeOnBackdrop !== false;
      if (closeOnBackdrop && backdrop) {
        backdrop.addEventListener('click', () => this.closeById(id));
      }

      // Update layering classes for non-top modals
      this._refreshLayering();

      // Prevent body scroll
      this._applyBodyLock();
    }

    closeById(id){
      const modal = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if (!modal) return;
      const removed = this.stack.remove(id);
      // Remove backdrop for this modal
      const bd = document.querySelector(`.sa-modal-backdrop[data-modal-id="${id}"]`);
      if (bd && bd.parentNode) bd.parentNode.removeChild(bd);

      // a11y restore focus
      try {
        if (typeof window !== 'undefined' && window.A11y && typeof window.A11y.closeDialog === 'function') {
          window.A11y.closeDialog(modal);
        }
      } catch (_) {}

      // Visual hide
    modal.classList.remove(CSS.ACTIVE);
      modal.classList.remove('sa-modal-background');
    modal.style.display = DISPLAY.NONE;
      modal.setAttribute('aria-hidden', 'true');

      // Re-layer remaining modals
      this._refreshLayering();

      // Restore body scroll if none open
      if (this.stack.depth() === 0) this._removeBodyLock();
      return removed;
    }

    closeTop(){
      const top = this.stack.top();
      if (!top) return null;
      this.closeById(top.id);
      return top.id;
    }

    // Close all open modals and ensure no orphan backdrops/body locks remain
    closeAll(){
      try {
        while (this.stack.depth() > 0) {
          this.closeTop();
        }
      } catch (_) {}
      // Defensive cleanup of any orphaned backdrops
      try {
        const leftovers = document.querySelectorAll('.sa-modal-backdrop');
        leftovers.forEach(el => { if (el && el.parentNode) el.parentNode.removeChild(el); });
      } catch (_) {}
      // Ensure body lock is removed
      try { this._removeBodyLock(); } catch (_) {}
    }

    isAnyOpen(){ return this.stack.depth() > 0; }

    _refreshLayering(){
      // Update z-indices and classes across stack
      this.stack.stack.forEach((entry, idx) => {
        const modal = document.getElementById(entry.id);
        if (!modal) return;
        entry.zIndexBackdrop = BASE_BACKDROP_Z + idx * Z_STEP;
        entry.zIndexModal = BASE_MODAL_Z + idx * Z_STEP;
        const bd = document.querySelector(`.sa-modal-backdrop[data-modal-id="${entry.id}"]`);
        if (bd) bd.style.zIndex = String(entry.zIndexBackdrop);
        modal.style.zIndex = String(entry.zIndexModal);
        if (idx < this.stack.depth() - 1) {
          modal.classList.add('sa-modal-background');
        } else {
          modal.classList.remove('sa-modal-background');
        }
      });
    }

    _applyBodyLock(){
      if (this._bodyClassApplied) return;
      document.body.classList.add('sa-modal-open');
      // Preserve current scroll position and prevent jitter, especially on mobile
      try {
        this._scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
        // Use fixed positioning to lock background while keeping visual position
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this._scrollY}px`;
        document.body.style.width = '100%';
      } catch (_) {}
      // Prevent touchmove/scroll bubbling on mobile when a modal is open
      try {
        this._touchBlock = (e) => {
          // Allow scrolling inside active modal content if it is scrollable
          const target = e.target;
          const topModal = this.stack.top();
          const activeModal = topModal ? document.getElementById(topModal.id) : null;
          if (activeModal && activeModal.contains(target)) {
            return; // do not block inside modal content
          }
          e.preventDefault();
        };
        document.addEventListener('touchmove', this._touchBlock, { passive: false });
      } catch (_) {}
      this._bodyClassApplied = true;
    }
    _removeBodyLock(){
      document.body.classList.remove('sa-modal-open');
      try {
        // Restore body positioning and scroll position
        const y = this._scrollY || 0;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
          window.scrollTo(0, y);
        }
      } catch (_) {}
      try {
        if (this._touchBlock) {
          document.removeEventListener('touchmove', this._touchBlock);
          this._touchBlock = null;
        }
      } catch (_) {}
      this._bodyClassApplied = false;
    }
  }

  // Export
  try { window.ModalController = new ModalController(); } catch (_) {}
  if (typeof module !== 'undefined') {
    module.exports = { ModalController, ModalStack };
  }
})();
