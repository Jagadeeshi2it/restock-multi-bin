/* Minimal state container — same contract as the setState() the prototype was written against:
 * setState(partial | fn(state) -> partial | null, callback). Render is synchronous on commit,
 * so a callback always sees the state it was queued behind. */
(function (RM) {
  'use strict';

  var data = RM.data;
  var initOrder = data.defaultBinOrder(data.products[0].bins);

  var initialState = {
    productIndex: 1,
    // Auto-drop into the default bin — no forced pick, no empty landing state.
    currentBinIndex: initOrder[0],
    panelOpen: false,
    checked: {},
    checkedBins: {},
    restockStarted: true,
    guidedBins: initOrder,        // the product's full bin cycle, in default order
    guidedPos: 0,                 // position within guidedBins of the bin being restocked
    lastBinIndex: initOrder[0],
    locks: {},                    // serialId -> { door, bin, binIndex }
    lockOrder: [],                // serialIds in commit order, for stable bottom ordering
    toast: null,
    allDone: false,
    lastDoor: data.products[0].bins[initOrder[0]].door,
    serials: data.freshSerials(data.products[0].serialCount),
    savedProducts: {},            // productIndex -> snapshot kept for retention
    // product-lineup panel
    productStatuses: ['current', 'pending', 'pending', 'pending'], // pending | current | skipped | done | partial
    productPanelOpen: false,
    prodSearch: '',
    prodStatusFilter: 'All',
    prodDoorFilter: 'All',
    pendingBinSwitch: null,       // target bin index awaiting the discard/save confirmation
    pendingProductJump: null,     // target product index awaiting the discard/save confirmation
    dirty: false,                 // any status edit in the current bin — enables Restock and Continue
    cancelModalOpen: false,       // footer Cancel confirmation
    editingNR: false,
    nrDraft: ''                   // inline-editable "Not Received" counter
  };

  var listeners = [];

  var store = {
    state: initialState,

    setState: function (patch, callback) {
      var next = typeof patch === 'function' ? patch(store.state) : patch;
      if (next) {
        var merged = {};
        for (var k in store.state) merged[k] = store.state[k];
        for (var j in next) merged[j] = next[j];
        store.state = merged;
        for (var i = 0; i < listeners.length; i++) listeners[i](store.state);
      }
      if (callback) callback();
    },

    subscribe: function (fn) { listeners.push(fn); }
  };

  RM.store = store;
})(window.RM = window.RM || {});
