// Centralized modal controller with stacking, z-index, keyboard handling, and a11y integration
// Exports ModalController and ModalStack for testing in Node environments

(function(){
  const BASE_BACKDROP_Z = 1000;
  const BASE_MODAL_Z = 1010;
  const Z_STEP = 20; // gap between stacked layers

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

    openById(id, options = {}){
      const modal = typeof document !== 'undefined' ? document.getElementById(id) : null;
      if (!modal) {
        console.warn('[ModalController] Modal not found:', id);
        return;
      }
      if (this.stack.has(id)) {
        // Already tracked; bring to top by removing and re-pushing
        this.stack.remove(id);
      }
      const entry = this.stack.push(id);

      // Visuals: backdrop per modal for strict stacking
      const backdrop = document.createElement('div');
      backdrop.className = 'sa-modal-backdrop';
      backdrop.dataset.modalId = id;
      backdrop.style.zIndex = String(entry.zIndexBackdrop);
      document.body.appendChild(backdrop);

      // Modal visuals and semantics
      modal.style.zIndex = String(entry.zIndexModal);
      modal.style.display = 'block';
      modal.classList.add('active');
      modal.classList.remove('sa-modal-background');
      modal.setAttribute('aria-hidden', 'false');
      modal.setAttribute('role', modal.getAttribute('role') || 'dialog');
      modal.setAttribute('aria-modal', 'true');

      // Focus management via A11y helper if available
      try {
        if (typeof window !== 'undefined' && window.A11y && typeof window.A11y.openDialog === 'function') {
          const { labelledBy, describedBy, focusFirst } = options;
          window.A11y.openDialog(modal, { labelledBy, describedBy, focusFirst });
        } else if (typeof modal.focus === 'function') {
          // Fallback: focus first focusable
          const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (focusable) focusable.focus();
        }
      } catch (_) {}

      // Backdrop click-to-close if enabled
      const closeOnBackdrop = options.closeOnBackdrop !== false;
      if (closeOnBackdrop) {
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
      modal.classList.remove('active');
      modal.classList.remove('sa-modal-background');
      modal.style.display = 'none';
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
      this._bodyClassApplied = true;
    }
    _removeBodyLock(){
      document.body.classList.remove('sa-modal-open');
      this._bodyClassApplied = false;
    }
  }

  // Export
  try { window.ModalController = new ModalController(); } catch (_) {}
  if (typeof module !== 'undefined') {
    module.exports = { ModalController, ModalStack };
  }
})();

