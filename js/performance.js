/**
 * Performance Optimization Module
 * Provides virtual scrolling, incremental rendering, and DOM diffing
 * to prevent heavy re-renders and improve performance with large datasets
 */

/**
 * Virtual Scroller for Large Lists
 * Only renders visible items + buffer, dramatically improves performance
 */
class VirtualScroller {
    constructor(options) {
        this.container = options.container;
        this.items = options.items || [];
        this.renderItem = options.renderItem;
        this.itemHeight = options.itemHeight || 60;
        this.buffer = options.buffer || 5;
        this.onVisibleRangeChange = options.onVisibleRangeChange;

        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.renderedItems = new Map();

        this.scrollContainer = null;
        this.viewport = null;
        this.contentHeight = 0;

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('VirtualScroller: Container not found');
            return;
        }

        // Create scroll container
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'virtual-scroll-container';
        this.scrollContainer.style.position = 'relative';

        // Create viewport
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-scroll-viewport';
        this.viewport.style.position = 'absolute';
        this.viewport.style.top = '0';
        this.viewport.style.left = '0';
        this.viewport.style.right = '0';

        this.scrollContainer.appendChild(this.viewport);
        this.container.innerHTML = '';
        this.container.appendChild(this.scrollContainer);

        // Bind scroll handler
        this.container.addEventListener('scroll', this.handleScroll.bind(this));

        // Initial render
        this.updateItems(this.items);
    }

    handleScroll() {
        this.render();
    }

    updateItems(items) {
        this.items = items || [];
        this.contentHeight = this.items.length * this.itemHeight;
        this.scrollContainer.style.height = `${this.contentHeight}px`;
        this.render();
    }

    render() {
        if (!this.container || this.items.length === 0) return;

        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;

        // Calculate visible range with buffer
        const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length,
            Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.buffer
        );

        // Skip if no change
        if (startIndex === this.visibleStart && endIndex === this.visibleEnd) {
            return;
        }

        this.visibleStart = startIndex;
        this.visibleEnd = endIndex;

        // Notify callback
        if (this.onVisibleRangeChange) {
            this.onVisibleRangeChange(startIndex, endIndex);
        }

        // Remove items outside visible range
        this.renderedItems.forEach((element, index) => {
            if (index < startIndex || index >= endIndex) {
                element.remove();
                this.renderedItems.delete(index);
            }
        });

        // Add new visible items
        const fragment = document.createDocumentFragment();

        for (let i = startIndex; i < endIndex; i++) {
            if (!this.renderedItems.has(i)) {
                const item = this.renderItem(this.items[i], i);
                item.style.position = 'absolute';
                item.style.top = `${i * this.itemHeight}px`;
                item.style.left = '0';
                item.style.right = '0';
                item.style.height = `${this.itemHeight}px`;
                item.dataset.index = i;

                this.renderedItems.set(i, item);
                fragment.appendChild(item);
            }
        }

        if (fragment.childNodes.length > 0) {
            this.viewport.appendChild(fragment);
        }
    }

    scrollToIndex(index) {
        if (index < 0 || index >= this.items.length) return;
        this.container.scrollTop = index * this.itemHeight;
    }

    destroy() {
        if (this.container) {
            this.container.removeEventListener('scroll', this.handleScroll);
        }
        this.renderedItems.clear();
    }
}

/**
 * Incremental Renderer
 * Renders large datasets in chunks to avoid blocking the UI
 */
class IncrementalRenderer {
    constructor(options) {
        this.items = options.items || [];
        this.renderItem = options.renderItem;
        this.container = options.container;
        this.chunkSize = options.chunkSize || 50;
        this.onProgress = options.onProgress;
        this.onComplete = options.onComplete;

        this.currentIndex = 0;
        this.isRendering = false;
        this.cancelled = false;
    }

    start() {
        if (this.isRendering) {
            console.warn('Rendering already in progress');
            return;
        }

        this.isRendering = true;
        this.cancelled = false;
        this.currentIndex = 0;
        this.renderChunk();
    }

    renderChunk() {
        if (this.cancelled || this.currentIndex >= this.items.length) {
            this.complete();
            return;
        }

        const fragment = document.createDocumentFragment();
        const endIndex = Math.min(this.currentIndex + this.chunkSize, this.items.length);

        for (let i = this.currentIndex; i < endIndex; i++) {
            const item = this.renderItem(this.items[i], i);
            fragment.appendChild(item);
        }

        this.container.appendChild(fragment);
        this.currentIndex = endIndex;

        // Report progress
        if (this.onProgress) {
            const progress = (this.currentIndex / this.items.length) * 100;
            this.onProgress(progress, this.currentIndex, this.items.length);
        }

        // Schedule next chunk (use requestIdleCallback if available)
        if (window.requestIdleCallback) {
            requestIdleCallback(() => this.renderChunk());
        } else {
            setTimeout(() => this.renderChunk(), 0);
        }
    }

    complete() {
        this.isRendering = false;
        if (this.onComplete && !this.cancelled) {
            this.onComplete();
        }
    }

    cancel() {
        this.cancelled = true;
        this.isRendering = false;
    }
}

/**
 * DOM Differ
 * Updates only changed attributes/content instead of full innerHTML replacement
 */
class DOMDiffer {
    /**
     * Update element attributes only if they changed
     */
    static updateAttributes(element, newAttributes) {
        if (!element || !newAttributes) return;

        // Remove old attributes not in new set
        Array.from(element.attributes).forEach(attr => {
            if (!(attr.name in newAttributes)) {
                element.removeAttribute(attr.name);
            }
        });

        // Add or update attributes
        Object.entries(newAttributes).forEach(([name, value]) => {
            const currentValue = element.getAttribute(name);
            if (currentValue !== value) {
                element.setAttribute(name, value);
            }
        });
    }

    /**
     * Update text content only if changed
     */
    static updateTextContent(element, newText) {
        if (!element) return;
        if (element.textContent !== newText) {
            element.textContent = newText;
        }
    }

    /**
     * Update a single table cell
     */
    static updateCell(cell, newContent, newClass = null) {
        if (!cell) return;

        // Update class if different
        if (newClass !== null && cell.className !== newClass) {
            cell.className = newClass;
        }

        // Update content if different
        if (cell.textContent !== newContent) {
            cell.textContent = newContent;
        }
    }

    /**
     * Batch update multiple cells in a row
     */
    static updateRow(row, updates) {
        if (!row || !updates) return;

        const cells = row.cells;
        updates.forEach((update, index) => {
            if (cells[index]) {
                if (typeof update === 'string') {
                    this.updateCell(cells[index], update);
                } else if (update.content !== undefined) {
                    this.updateCell(cells[index], update.content, update.className);
                }
            }
        });
    }
}

/**
 * Optimized Table Renderer
 * For profile grid - updates only changed rows
 */
class OptimizedTableRenderer {
    constructor(tableBody) {
        this.tbody = tableBody;
        this.rowCache = new Map(); // evaluationId -> row element
        this.rowData = new Map(); // evaluationId -> data hash
    }

    /**
     * Generate a simple hash of row data
     */
    hashRowData(data) {
        return JSON.stringify({
            rank: data.rank,
            marine: data.marineName,
            occasion: data.occasion,
            date: data.endDate,
            avg: data.average,
            rv: data.rv,
            cumRv: data.cumRv,
            syncStatus: data.syncStatus,
            grades: data.grades
        });
    }

    /**
     * Update table with new data
     * Only modifies changed rows
     */
    updateTable(evaluations, renderRow) {
        const newIds = new Set(evaluations.map(e => e.evaluationId));

        // Remove rows for deleted evaluations
        this.rowCache.forEach((row, id) => {
            if (!newIds.has(id)) {
                // Remove both data row and details row
                row.remove();
                const detailsRow = this.tbody.querySelector(`tr.grid-details-row[data-eval-id="${id}"]`);
                if (detailsRow) detailsRow.remove();

                this.rowCache.delete(id);
                this.rowData.delete(id);
            }
        });

        // Fragment for new rows
        const fragment = document.createDocumentFragment();

        evaluations.forEach((evaluation, index) => {
            const id = evaluation.evaluationId;
            const newHash = this.hashRowData(evaluation);
            const existingRow = this.rowCache.get(id);

            if (!existingRow) {
                // New row - render it
                const { dataRow, detailsRow } = renderRow(evaluation, index);
                this.rowCache.set(id, dataRow);
                this.rowData.set(id, newHash);
                fragment.appendChild(dataRow);
                fragment.appendChild(detailsRow);
            } else {
                // Existing row - check if data changed
                const oldHash = this.rowData.get(id);
                if (oldHash !== newHash) {
                    // Data changed - update the row
                    const { dataRow, detailsRow } = renderRow(evaluation, index);
                    existingRow.replaceWith(dataRow);

                    // Update details row if it exists
                    const oldDetailsRow = this.tbody.querySelector(`tr.grid-details-row[data-eval-id="${id}"]`);
                    if (oldDetailsRow) {
                        oldDetailsRow.replaceWith(detailsRow);
                    }

                    this.rowCache.set(id, dataRow);
                    this.rowData.set(id, newHash);
                }
                // If hash is same, do nothing (row unchanged)
            }
        });

        // Append new rows
        if (fragment.childNodes.length > 0) {
            this.tbody.appendChild(fragment);
        }

        // Reorder rows to match evaluation order
        this.reorderRows(evaluations);
    }

    /**
     * Reorder DOM elements to match data order
     * Only if order changed
     */
    reorderRows(evaluations) {
        const currentOrder = Array.from(this.tbody.children)
            .filter(row => row.hasAttribute('data-eval-id') && !row.classList.contains('grid-details-row'))
            .map(row => row.getAttribute('data-eval-id'));

        const newOrder = evaluations.map(e => e.evaluationId);

        // Check if order changed
        const orderChanged = currentOrder.some((id, index) => id !== newOrder[index]);

        if (orderChanged) {
            const fragment = document.createDocumentFragment();

            evaluations.forEach(evaluation => {
                const id = evaluation.evaluationId;
                const dataRow = this.rowCache.get(id);
                const detailsRow = this.tbody.querySelector(`tr.grid-details-row[data-eval-id="${id}"]`);

                if (dataRow) {
                    fragment.appendChild(dataRow);
                    if (detailsRow) {
                        fragment.appendChild(detailsRow);
                    }
                }
            });

            this.tbody.innerHTML = '';
            this.tbody.appendChild(fragment);
        }
    }

    clear() {
        this.rowCache.clear();
        this.rowData.clear();
        this.tbody.innerHTML = '';
    }
}

/**
 * Request Animation Frame helper for smooth updates
 */
class RAFQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    add(callback) {
        this.queue.push(callback);
        if (!this.isProcessing) {
            this.process();
        }
    }

    process() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        requestAnimationFrame(() => {
            const callback = this.queue.shift();
            if (callback) {
                callback();
            }
            this.process();
        });
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.VirtualScroller = VirtualScroller;
    window.IncrementalRenderer = IncrementalRenderer;
    window.DOMDiffer = DOMDiffer;
    window.OptimizedTableRenderer = OptimizedTableRenderer;
    window.RAFQueue = RAFQueue;
}
