/* Restock — Multi Bin · workflow logic
 *
 * Everything that mutates state lives here. The rules the flow is built on:
 *   · A serial is free until it is committed. Committing happens on "Restock and Continue"
 *     (or on the save branch of a switch confirmation), never on a status edit alone.
 *   · A committed serial is read-only for the rest of the transaction — correction happens
 *     via Undo on the History page.
 *   · Leaving a bin or a product with uncommitted edits always asks first: save or discard.
 */
(function (RM) {
  'use strict';

  var data = RM.data;
  var store = RM.store;
  var products = data.products;
  var binsAt = data.binsAt;

  function state() { return store.state; }
  function setState(patch, cb) { store.setState(patch, cb); }
  function curBins() { return binsAt(state().productIndex); }

  var toastTimer = null;

  var A = {};

  A.preventDefault = function (e) { e.preventDefault(); };

  A.showToast = function (msg) {
    setState({ toast: msg });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      setState(function (s) { return s.toast === msg ? { toast: null } : null; });
    }, 2600);
  };
  A.onCloseToast = function () { setState({ toast: null }); };

  A.openPanel = function () { setState({ panelOpen: true }); };
  A.onOpenPanelEv = function (e) { if (e) e.preventDefault(); A.openPanel(); };
  A.closePanel = function () { setState({ panelOpen: false }); };

  /* Commit every actioned-but-unlocked serial to the bin the user is currently standing at.
   * Shared by "Restock and Continue" and the switch confirmations so a switch always saves. */
  A.commitCurrentBin = function (s) {
    var at = s.currentBinIndex != null ? s.currentBinIndex : s.lastBinIndex;
    if (at == null) return { locks: s.locks, lockOrder: s.lockOrder };
    var bin = binsAt(s.productIndex)[at];
    var locks = {};
    for (var k in s.locks) locks[k] = s.locks[k];
    var lockOrder = s.lockOrder.slice();
    s.serials.forEach(function (x) {
      if (x.status !== '--' && !locks[x.id]) {
        locks[x.id] = { door: bin.door, bin: bin.bin, binIndex: at };
        lockOrder.push(x.id);
      } else if (x.status === '--' && locks[x.id] && locks[x.id].binIndex === at) {
        // Cleared back to -- at its own bin: drop the commitment so its location clears too.
        delete locks[x.id];
        lockOrder = lockOrder.filter(function (id) { return id !== x.id; });
      }
    });
    return { locks: locks, lockOrder: lockOrder };
  };

  /* When returning to a bin, pre-check the serials already committed there so Reset selected
   * (and the header select-all) act on them in one click. */
  A.autoCheckFor = function (binIndex, locks) {
    var checked = {};
    if (binIndex == null) return checked;
    Object.keys(locks).forEach(function (id) {
      if (locks[id].binIndex === binIndex) checked[id] = true;
    });
    return checked;
  };

  /* Uncommitted = actioned in the current bin but not yet locked (saved) to a bin. */
  A.hasUncommitted = function (s) {
    return s.serials.some(function (x) { return x.status !== '--' && !s.locks[x.id]; });
  };

  /* A finalized product is 'partial' when the committed serials (Restocked + Damaged +
   * Not Received) don't cover the full ordered quantity — the remaining serials are still '--'
   * and the product can be revisited later to fulfil them. */
  A.finalStatusFor = function (pIdx, serialsArr, locksObj) {
    var ordered = products[pIdx - 1].serialCount;
    var committedCount = serialsArr.filter(function (x) { return locksObj[x.id]; }).length;
    return committedCount < ordered ? 'partial' : 'done';
  };

  /* ---- Bin switching ------------------------------------------------------ */

  /* Side-panel bin pick. If the current bin has unsaved edits, ask first (discard vs save);
   * otherwise switch straight through — no save. */
  A.selectBin = function (i) {
    if (A.hasUncommitted(state())) { setState({ pendingBinSwitch: i }); return; }
    A.doSwitchBin(i, { locks: state().locks, lockOrder: state().lockOrder });
  };

  A.doSwitchBin = function (i, committed) {
    var bin = curBins()[i];
    var doorChanged = state().lastDoor != null && state().lastDoor !== bin.door;
    var pos = (state().guidedBins || []).indexOf(i);
    setState({
      locks: committed.locks, lockOrder: committed.lockOrder,
      currentBinIndex: i, lastBinIndex: i,
      guidedPos: pos >= 0 ? pos : state().guidedPos,
      panelOpen: false, pendingBinSwitch: null, dirty: false,
      checked: A.autoCheckFor(i, committed.locks), lastDoor: bin.door, restockStarted: true
    }, function () {
      if (doorChanged) A.showToast('Door ' + bin.door + ' is unlocked now');
    });
  };

  /* Modal: discard the current bin's uncommitted edits, then switch. */
  A.onDiscardSwitch = function () {
    var i = state().pendingBinSwitch;
    var locks = state().locks;
    var serials = state().serials.map(function (x) {
      return (x.status !== '--' && !locks[x.id]) ? Object.assign({}, x, { status: '--' }) : x;
    });
    setState({ serials: serials }, function () {
      A.doSwitchBin(i, { locks: state().locks, lockOrder: state().lockOrder });
    });
  };

  /* Modal: save (lock) the current bin's edits via Restock and continue, then switch. */
  A.onSaveSwitch = function () {
    var i = state().pendingBinSwitch;
    var committed = A.commitCurrentBin(state());
    var savedCount = committed.lockOrder.length - state().lockOrder.length;
    A.doSwitchBin(i, committed);
    if (savedCount > 0) A.showToast(savedCount + ' serial' + (savedCount > 1 ? 's' : '') + ' restocked');
  };

  A.onCancelSwitch = function () { setState({ pendingBinSwitch: null }); };

  /* ---- Footer cancel ------------------------------------------------------ */

  A.onOpenCancel = function () { setState({ cancelModalOpen: true }); };
  A.onCloseCancel = function () { setState({ cancelModalOpen: false }); };
  A.onConfirmCancel = function () {
    setState({ cancelModalOpen: false });
    A.showToast('Restock process cancelled');
  };

  /* ---- Row editing -------------------------------------------------------- */

  A.setStatus = function (id, val) {
    setState(function (s) {
      return {
        serials: s.serials.map(function (x) {
          return x.id === id ? Object.assign({}, x, { status: val }) : x;
        }),
        dirty: true
      };
    });
  };

  A.toggleCheck = function (id) {
    setState(function (s) {
      var next = Object.assign({}, s.checked);
      next[id] = !next[id];
      return { checked: next };
    });
  };

  A.toggleCheckAll = function () {
    var s = state();
    var rows = s.serials.filter(function (x) { return !s.locks[x.id]; });
    var allChecked = rows.length > 0 && rows.every(function (r) { return s.checked[r.id]; });
    var next = Object.assign({}, s.checked);
    rows.forEach(function (r) { next[r.id] = !allChecked; });
    setState({ checked: next });
  };

  A.bulkSet = function (val) {
    var checked = state().checked;
    setState(function (s) {
      return {
        serials: s.serials.map(function (x) {
          return checked[x.id] ? Object.assign({}, x, { status: val }) : x;
        }),
        checked: {},
        dirty: true
      };
    });
  };
  A.onRestockSelected = function () { A.bulkSet('Restocked'); };
  A.onResetSelected = function () { A.bulkSet('--'); };

  /* "Not Received" counter is directly editable — typing a number marks that many available
   * serials as Not Received (or clears the extras back to --). */
  A.startEditNR = function () {
    setState({
      editingNR: true,
      nrDraft: String(state().serials.filter(function (x) { return x.status === 'Not Received'; }).length)
    });
  };
  A.onNRInput = function (e) { setState({ nrDraft: e.target.value.replace(/[^0-9]/g, '') }); };
  A.onNRKey = function (e) {
    if (e.key === 'Enter') A.commitNR();
    else if (e.key === 'Escape') setState({ editingNR: false });
  };
  A.commitNR = function () {
    setState(function (s) {
      var n = parseInt(s.nrDraft, 10);
      if (isNaN(n) || n < 0) n = 0;
      if (n > s.serials.length) n = s.serials.length;
      var serials = s.serials.map(function (x) { return Object.assign({}, x); });
      var nr = serials.filter(function (x) { return x.status === 'Not Received'; }).length;
      if (n > nr) {
        var need = n - nr;
        for (var i = 0; i < serials.length && need; i++) {
          if (serials[i].status === '--' && !s.locks[serials[i].id]) { serials[i].status = 'Not Received'; need--; }
        }
      } else if (n < nr) {
        var rm = nr - n;
        for (var j = serials.length - 1; j >= 0 && rm; j--) {
          if (serials[j].status === 'Not Received' && !s.locks[serials[j].id]) { serials[j].status = '--'; rm--; }
        }
      }
      return { serials: serials, editingNR: false, dirty: true };
    });
  };

  A.toggleBinCheck = function (i) {
    setState(function (s) {
      var next = Object.assign({}, s.checkedBins);
      next[i] = !next[i];
      return { checkedBins: next };
    });
  };

  /* ---- Guided walk -------------------------------------------------------- */

  /* Landing-panel "Start restock" — kicks off the guided flow across every checked bin, in order. */
  A.onStartGuided = function () {
    var s = state();
    var checkedIdx = Object.keys(s.checkedBins)
      .filter(function (k) { return s.checkedBins[k]; })
      .map(Number)
      .sort(function (a, b) { return a - b; });
    if (checkedIdx.length === 0) return;
    setState({ checkedBins: {}, guidedBins: checkedIdx, guidedPos: 0 });
    A.doSwitchBin(checkedIdx[0], { locks: state().locks, lockOrder: state().lockOrder });
  };

  /* Advances the guided walk: commits (or discards) the current bin's edits, then moves to the
   * next checked bin in line — or, if this was the last one, finalizes and moves to the next product. */
  A.advanceBin = function (commitCurrent) {
    var s = state();
    var guidedBins = s.guidedBins, guidedPos = s.guidedPos, currentBinIndex = s.currentBinIndex;
    var committed = commitCurrent
      ? A.commitCurrentBin(s)
      : { locks: s.locks, lockOrder: s.lockOrder };
    // If every serial is now assigned to a bin, the product is fully restocked — go straight to
    // the next product, no need to walk the remaining bins.
    var allAssigned = s.serials.every(function (x) { return committed.locks[x.id]; });
    var isLast = allAssigned || guidedPos >= guidedBins.length - 1;
    if (isLast) {
      var pIdx = s.productIndex;
      var nextProduct = pIdx >= products.length ? 1 : pIdx + 1;
      var statuses = s.productStatuses.slice();
      statuses[pIdx - 1] = A.finalStatusFor(pIdx, s.serials, committed.locks);
      if (statuses[nextProduct - 1] !== 'done') statuses[nextProduct - 1] = 'current';
      setState({
        locks: committed.locks, lockOrder: committed.lockOrder,
        lastBinIndex: currentBinIndex, currentBinIndex: null
      }, function () { A.enterProduct(nextProduct, statuses, false); });
      A.showToast(products[pIdx - 1].title + ' successfully restocked');
    } else {
      var nextPos = guidedPos + 1;
      var nextBinIdx = guidedBins[nextPos];
      setState({ guidedPos: nextPos }, function () { A.doSwitchBin(nextBinIdx, committed); });
    }
  };

  A.onUnlockDoor = function () {
    var cur = state().currentBinIndex;
    if (cur == null) { A.showToast('Select a location to unlock a door'); return; }
    A.showToast('Door ' + curBins()[cur].door + ' is unlocked now');
  };

  A.onRestockContinue = function () {
    if (state().currentBinIndex == null) return;
    A.advanceBin(true);
  };

  /* Skips the CURRENT BIN in the guided walk — discards its uncommitted edits and moves to the
   * next checked bin in line (or finalizes the product if this was the last one). */
  A.onSkip = function () {
    var s = state();
    if (s.currentBinIndex == null) return;
    var serials = s.serials.map(function (x) {
      return (x.status !== '--' && !s.locks[x.id]) ? Object.assign({}, x, { status: '--' }) : x;
    });
    setState({ serials: serials, dirty: false }, function () { A.advanceBin(false); });
  };

  /* Landing-panel "Skip product" — abandons this product entirely (before any bin is picked)
   * and advances to the next one. */
  A.onSkipProduct = function () {
    var cur = state().productIndex;
    var nextProduct = cur >= products.length ? 1 : cur + 1;
    var statuses = state().productStatuses.slice();
    if (statuses[cur - 1] !== 'done') statuses[cur - 1] = 'skipped';
    if (statuses[nextProduct - 1] !== 'done') statuses[nextProduct - 1] = 'current';
    A.enterProduct(nextProduct, statuses, true);
    A.showToast(products[cur - 1].title + ' is skipped');
  };

  /* Central product switch. Snapshots the product being left (unless discardCurrent) so its
   * work is restored on return, and restores the target's prior snapshot if one exists. */
  A.enterProduct = function (targetIdx, statuses, discardCurrent) {
    setState(function (s) {
      var saved = Object.assign({}, s.savedProducts);
      if (discardCurrent) delete saved[s.productIndex];
      else saved[s.productIndex] = {
        serials: s.serials, locks: s.locks, lockOrder: s.lockOrder,
        lastBinIndex: s.lastBinIndex, guidedBins: s.guidedBins, guidedPos: s.guidedPos
      };
      var prior = saved[targetIdx];
      var restored;
      if (prior) {
        restored = {
          serials: prior.serials, locks: prior.locks, lockOrder: prior.lockOrder,
          lastBinIndex: prior.lastBinIndex,
          currentBinIndex: prior.lastBinIndex,
          panelOpen: prior.lastBinIndex == null,
          restockStarted: true,
          guidedBins: prior.guidedBins || [],
          guidedPos: prior.guidedPos || 0
        };
      } else {
        var order = data.defaultBinOrder(binsAt(targetIdx));
        restored = {
          serials: data.freshSerials(products[targetIdx - 1].serialCount),
          locks: {}, lockOrder: [],
          lastBinIndex: order[0],
          currentBinIndex: order[0],
          panelOpen: false,
          restockStarted: true,
          guidedBins: order,
          guidedPos: 0
        };
      }
      var base = {
        savedProducts: saved,
        productStatuses: statuses,
        productIndex: targetIdx,
        checked: A.autoCheckFor(restored.currentBinIndex, restored.locks),
        dirty: false,
        allDone: false,
        productPanelOpen: false,
        checkedBins: {},
        lastDoor: restored.currentBinIndex != null ? binsAt(targetIdx)[restored.currentBinIndex].door : null
      };
      return Object.assign(base, restored);
    });
  };

  /* Partial restock: keep everything already committed to bins, discard the remaining
   * uncommitted serials, and move on to the next product. */
  A.finishProductPartial = function () {
    var s = state();
    var cur = s.productIndex;
    var nextProduct = cur >= products.length ? 1 : cur + 1;
    var statuses = s.productStatuses.slice();
    statuses[cur - 1] = A.finalStatusFor(cur, s.serials, s.locks);
    if (statuses[nextProduct - 1] !== 'done') statuses[nextProduct - 1] = 'current';
    A.enterProduct(nextProduct, statuses, false);
    A.showToast(statuses[cur - 1] === 'partial'
      ? products[cur - 1].title + ' is partially restocked'
      : products[cur - 1].title + ' successfully restocked');
  };

  /* ---- Product lineup panel ----------------------------------------------- */

  A.openProductPanel = function (e) { if (e) e.preventDefault(); setState({ productPanelOpen: true }); };
  A.closeProductPanel = function () { setState({ productPanelOpen: false }); };
  A.setProdFilter = function (key) {
    return function (e) {
      var patch = {};
      patch[key] = e.target.value;
      setState(patch);
    };
  };

  /* Product jump from the footer panel. Like a bin switch, if the current bin has unsaved edits
   * we confirm first (save via Restock and continue, or discard) for consistency. */
  A.jumpToProduct = function (targetIdx) {
    var cur = state().productIndex;
    if (targetIdx === cur) { setState({ productPanelOpen: false }); return; }
    if (A.hasUncommitted(state())) { setState({ pendingProductJump: targetIdx }); return; }
    A.doJumpProduct(targetIdx);
  };

  A.doJumpProduct = function (targetIdx) {
    var s = state();
    var cur = s.productIndex;
    var statuses = s.productStatuses.slice();
    var lo = Math.min(cur, targetIdx), hi = Math.max(cur, targetIdx);
    for (var i = lo + 1; i < hi; i++) {
      if (statuses[i - 1] !== 'done') statuses[i - 1] = 'skipped';
    }
    if (statuses[cur - 1] !== 'done' && statuses[cur - 1] !== 'partial') {
      statuses[cur - 1] = Object.keys(s.locks).length > 0
        ? A.finalStatusFor(cur, s.serials, s.locks)
        : 'skipped';
    }
    statuses[targetIdx - 1] = 'current';
    setState({ pendingProductJump: null });
    A.enterProduct(targetIdx, statuses, false);
    A.showToast('Now on product ' + targetIdx + '/' + products.length + ' — ' + products[targetIdx - 1].title);
  };

  A.onDiscardProductJump = function () {
    var s = state();
    var t = s.pendingProductJump;
    var serials = s.serials.map(function (x) {
      return (x.status !== '--' && !s.locks[x.id]) ? Object.assign({}, x, { status: '--' }) : x;
    });
    setState({ serials: serials, dirty: false }, function () { A.doJumpProduct(t); });
  };
  A.onSaveProductJump = function () {
    var t = state().pendingProductJump;
    var committed = A.commitCurrentBin(state());
    setState({ locks: committed.locks, lockOrder: committed.lockOrder, dirty: false },
      function () { A.doJumpProduct(t); });
  };
  A.onCancelProductJump = function () { setState({ pendingProductJump: null }); };

  RM.actions = A;
})(window.RM = window.RM || {});
