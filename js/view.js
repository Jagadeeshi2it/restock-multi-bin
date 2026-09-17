/* Derived view model — pure function of state. Nothing in here mutates; the renderer reads it
 * and the action dispatcher (render.js) maps data-act attributes back onto RM.actions. */
(function (RM) {
  'use strict';

  var data = RM.data;
  var A = RM.actions;
  var products = data.products;

  var STATUS_COLORS = {
    'Restocked': '#008774',
    'Damaged': '#D9342B',
    'Damaged - Require replacement': '#D9342B',
    'Not Received': '#757575',
    '--': '#9FA9B7'
  };

  var STATUS_META = {
    current: { label: 'Current', bg: '#D8E6FD', color: '#1B4577' },
    done: { label: 'Restocked', bg: '#D9F2EF', color: '#007F6D' },
    partial: { label: 'Partial', bg: '#FBF1D7', color: '#8F7322' },
    skipped: { label: 'Skipped', bg: '#FBF1D7', color: '#8F7322' },
    pending: { label: 'Pending', bg: '#F5F5F5', color: '#757575' }
  };

  var STATUS_FILTER_OPTIONS = ['All', 'Current', 'Restocked', 'Partial', 'Skipped'];

  /* Product chips map onto the design system's category classes (ally-components.css). Vial type
   * shares the one dark chip; anything unrecognised falls back to it rather than going unstyled. */
  var BADGE_CATEGORY = {
    SDV: 'cat-sdv',
    MDV: 'cat-sdv',
    CLIMATE: 'cat-climate',
    PACK: 'cat-pack',
    CIV: 'cat-civ'
  };

  function badges(labels) {
    return (labels || []).map(function (label) {
      return { label: label, category: BADGE_CATEGORY[label] || 'cat-sdv' };
    });
  }

  // Single-quoted on purpose: this lands in a double-quoted style="" attribute, and a double
  // quote here would close the attribute and drop the background (and the rules after it).
  // The SVG's own quotes are safe — encodeURIComponent turns them into %22.
  function chevron(color) {
    return "url('data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="' +
      color + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
    ) + "')";
  }

  function build(s) {
    var curProduct = products[s.productIndex - 1];
    var bins = curProduct.bins;
    var locks = s.locks, checked = s.checked, serials = s.serials;

    // Once a serial is committed to a bin it is read-only for the rest of the transaction —
    // including at the bin it was saved in. Correction happens via Undo on the History page.
    function isLocked(x) { return !!locks[x.id]; }

    var ordered = serials.length;
    var restockedCount = serials.filter(function (x) { return x.status === 'Restocked'; }).length;
    var damagedCount = serials.filter(function (x) { return x.status === 'Damaged'; }).length;
    var notReceivedCount = serials.filter(function (x) { return x.status === 'Not Received'; }).length;

    var curBin = s.currentBinIndex != null ? bins[s.currentBinIndex] : null;
    var showLocationColumn = true;
    var gridTemplate = showLocationColumn
      ? '32px 1.6fr 1fr 1fr 1.4fr 1.2fr 1fr'
      : '32px 1.6fr 1fr 1fr 1.4fr 1fr';

    var unlockedRows = serials.filter(function (x) { return !isLocked(x); });
    var lockedRowsOrdered = s.lockOrder
      .map(function (id) { return serials.find(function (x) { return x.id === id; }); })
      .filter(function (x) { return x && isLocked(x); });
    var orderedRows = unlockedRows.concat(lockedRowsOrdered);

    var rows = orderedRows.map(function (x) {
      var locked = isLocked(x);
      var interactive = !locked;
      // Show the location as soon as a status is set — the current bin for uncommitted edits,
      // the locked bin once saved.
      var loc = locks[x.id] || (x.status !== '--' && curBin ? { door: curBin.door, bin: curBin.bin } : null);
      return {
        id: x.id, serial: x.serial, lot: x.lot, exp: x.exp,
        inventory: '1 vial / 200 mg / 20 mL',
        locationText: (loc && x.status !== '--') ? 'Door: ' + loc.door + '\nBin: ' + loc.bin : '--',
        checked: !!checked[x.id],
        checkDisabled: !interactive,
        showCheckmark: locked,
        showCheckbox: !locked,
        showStatusText: locked,
        showSelect: !locked,
        status: x.status,
        statusTextStyle: { color: STATUS_COLORS[x.status] || '#465161', fontWeight: 600 },
        selectDisabled: !interactive,
        selectStyle: {
          width: '100%', padding: '8px 32px 8px 10px', borderRadius: 4, fontSize: 14,
          border: '1px solid ' + (interactive ? '#BCC3CD' : '#DADEE3'),
          color: interactive ? '#25282A' : '#9FA9B7',
          cursor: interactive ? 'pointer' : 'not-allowed',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          backgroundColor: interactive ? '#fff' : '#F7F8F9',
          backgroundImage: chevron(interactive ? '#465161' : '#BCC3CD'),
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          backgroundSize: '12px 12px'
        }
      };
    });

    var allChecked = unlockedRows.length > 0 && unlockedRows.every(function (x) { return checked[x.id]; });
    var selectAllDisabled = unlockedRows.length === 0;
    var checkedIds = Object.keys(checked).filter(function (k) { return checked[k]; });
    var hasChecked = checkedIds.length > 0;
    // If everything currently checked is already Restocked, "Restock selected" is a no-op —
    // keep it disabled (only Reset selected is useful when you return to a stocked bin).
    var allCheckedRestocked = hasChecked && checkedIds.every(function (id) {
      var cs = serials.find(function (x) { return x.id === id; });
      return cs && cs.status === 'Restocked';
    });
    var restockSelectedDisabled = !hasChecked || allCheckedRestocked;
    var resetSelectedDisabled = !hasChecked;

    var btnBase = { padding: '10px 18px', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: '0.3px', cursor: 'pointer' };
    function withBase(extra) { return Object.assign({}, btnBase, extra); }

    var restockSelectedStyle = restockSelectedDisabled
      ? withBase({ background: '#fff', border: '1px solid #C9D5E3', color: '#9FB4CE', cursor: 'not-allowed' })
      : withBase({ background: '#fff', border: '1px solid #095192', color: '#095192' });
    var resetSelectedStyle = resetSelectedDisabled
      ? withBase({ background: '#fff', border: '1px solid #DADEE3', color: '#BCC3CD', cursor: 'not-allowed' })
      : withBase({ background: '#fff', border: '1px solid #BCC3CD', color: '#465161' });

    // Enabled only when there is uncommitted work in this bin: either a live dirty edit, or a
    // serial with a status that isn't locked yet. Revisiting a bin/product where everything is
    // already committed must NOT re-enable the button — allAssigned alone is not a valid trigger.
    var allAssigned = serials.every(function (x) { return x.status !== '--'; });
    var uncommittedWork = A.hasUncommitted(s);
    var restockContinueDisabled = s.allDone || curBin === null || (!s.dirty && !uncommittedWork);
    var isLastBinStep = allAssigned || s.guidedPos >= s.guidedBins.length - 1;
    var isLastProductStep = s.productIndex >= products.length;
    var restockContinueLabel = s.allDone
      ? 'ALL BINS RESTOCKED'
      : (isLastBinStep && isLastProductStep ? 'RESTOCK AND FINISH' : 'RESTOCK AND CONTINUE');
    var restockContinueBtnStyle = restockContinueDisabled
      ? withBase({ background: '#fff', border: '1px solid #C9D5E3', color: '#9FB4CE', cursor: 'not-allowed' })
      : withBase({ background: '#095192', border: '1px solid #095192', color: '#fff' });

    // Skip & continue moves past the current bin in the cycle. Disabled the moment any change is
    // made in this bin; re-enabled once all those changes are undone in the current session.
    var skipDisabled = s.allDone || curBin === null || uncommittedWork;
    var skipBase = { padding: '11px 20px', borderRadius: 4, fontWeight: 600, fontSize: 13, letterSpacing: '0.3px', background: '#fff' };
    var skipStyle = skipDisabled
      ? Object.assign({}, skipBase, { border: '1px solid #DADEE3', color: '#BCC3CD', cursor: 'not-allowed' })
      : Object.assign({}, skipBase, { border: '1px solid #BCC3CD', color: '#465161', cursor: 'pointer' });

    var hasBin = s.currentBinIndex != null;
    var panelLanding = !s.restockStarted;

    // Jump panel lists every bin the product lives in (default order), so the user can jump anywhere.
    var visibleBinIdxs = data.defaultBinOrder(bins);
    var panelBins = visibleBinIdxs.map(function (i) {
      var b = bins[i];
      // Reflect changes instantly: committed serials for this bin, plus live uncommitted edits
      // in the bin the user is currently standing in.
      var binSerials = serials.filter(function (x) {
        return (locks[x.id] && locks[x.id].binIndex === i) ||
          (!locks[x.id] && i === s.currentBinIndex && x.status !== '--');
      });
      var restocked = binSerials.filter(function (x) { return x.status === 'Restocked'; }).length;
      var damaged = binSerials.filter(function (x) { return x.status === 'Damaged'; }).length;
      var activeBin = s.currentBinIndex != null ? s.currentBinIndex : s.lastBinIndex;
      var isCurrent = i === activeBin;
      return {
        index: i,
        door: b.door, bin: b.bin, size: b.size, exp: b.exp, inventory: b.inventory,
        restocked: restocked ? String(restocked) : '-',
        damaged: damaged ? String(damaged) : '-',
        isCurrent: isCurrent,
        showCheck: false,
        checkedBin: false,
        viewOnly: true,
        actionLabel: isCurrent ? 'Current bin' : 'Select',
        actionDisabled: isCurrent,
        actionStyle: {
          color: isCurrent ? '#9FA9B7' : '#095192', fontWeight: 600, fontSize: 14,
          cursor: isCurrent ? 'default' : 'pointer'
        }
      };
    });

    var startDisabled = Object.keys(s.checkedBins).filter(function (k) { return s.checkedBins[k]; }).length === 0;
    var startRestockStyle = startDisabled
      ? withBase({ background: '#9FB4CE', border: '1px solid #9FB4CE', color: '#fff', cursor: 'not-allowed' })
      : withBase({ background: '#095192', border: '1px solid #095192', color: '#fff', cursor: 'pointer' });

    /* ---- Product lineup panel ---- */
    var doorFilterOptions = ['All'].concat(
      Array.from(new Set(products.reduce(function (acc, p) {
        return acc.concat(p.bins.map(function (b) { return 'Door ' + b.door; }));
      }, []))).sort()
    );
    var filterSelectStyle = { padding: '9px 12px', border: '1px solid #BCC3CD', borderRadius: 4, fontSize: 14, background: '#fff', color: '#465161' };

    var q = (s.prodSearch || '').trim().toLowerCase();
    var productList = products.map(function (p, i) {
      var st = s.productStatuses[i] || 'pending';
      var meta = STATUS_META[st];
      var isCurrent = (i + 1) === s.productIndex;
      var matchesSearch = !q || p.title.toLowerCase().indexOf(q) >= 0 || p.ndc.indexOf(q) >= 0;
      var matchesStatus = s.prodStatusFilter === 'All' || meta.label === s.prodStatusFilter;
      var matchesDoor = s.prodDoorFilter === 'All' || p.bins.some(function (b) { return 'Door ' + b.door === s.prodDoorFilter; });
      var locText = p.bins.length === 1
        ? 'Door ' + p.bins[0].door + ' · Bin ' + p.bins[0].bin
        : p.bins.length + ' locations';
      return {
        idx: i + 1, title: p.title, ndc: p.ndc, badges: badges(p.badges),
        locationText: locText,
        statusLabel: meta.label,
        statusStyle: {
          display: st === 'pending' ? 'none' : 'inline-block', background: meta.bg, color: meta.color,
          fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
          letterSpacing: '0.3px', whiteSpace: 'nowrap'
        },
        cardStyle: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '16px 18px', border: '1px solid ' + (isCurrent ? '#095192' : '#DADEE3'),
          borderRadius: 10, background: isCurrent ? '#EBF3FE' : '#fff', cursor: 'pointer'
        },
        visible: matchesSearch && matchesStatus && matchesDoor
      };
    }).filter(function (p) { return p.visible; });

    return {
      productTitle: curProduct.title,
      productBadges: badges(curProduct.badges),
      ndcLabel: curProduct.ndc,
      orderLabel: curProduct.order,
      sourceLabel: curProduct.source,
      doorLabel: curBin ? String(curBin.door) : '--',
      binLabel: curBin ? String(curBin.bin) : '--',
      inventoryLabel: curBin ? curBin.inventory + ' vials' : '--',
      showLocationColumn: showLocationColumn,
      gridTemplate: gridTemplate,
      hasBin: hasBin,
      noBin: !hasBin,

      ordered: ordered, restockedCount: restockedCount, damagedCount: damagedCount,
      notReceivedCount: notReceivedCount,
      nrEditing: s.editingNR, nrView: !s.editingNR, nrDraft: s.nrDraft,

      rows: rows, allChecked: allChecked, selectAllDisabled: selectAllDisabled,
      restockSelectedDisabled: restockSelectedDisabled, resetSelectedDisabled: resetSelectedDisabled,
      restockSelectedStyle: restockSelectedStyle, resetSelectedStyle: resetSelectedStyle,

      restockContinueDisabled: restockContinueDisabled, restockContinueLabel: restockContinueLabel,
      restockContinueBtnStyle: restockContinueBtnStyle,
      skipDisabled: skipDisabled, skipStyle: skipStyle, skipLabel: 'SKIP & CONTINUE',

      footerBinLabel: curBin ? (s.guidedPos + 1) + '/' + ((s.guidedBins && s.guidedBins.length) || bins.length) : 'Select location',
      footerRestockedCount: serials.filter(function (x) { return locks[x.id] && x.status === 'Restocked'; }).length,
      footerProductLabel: s.productIndex + '/' + products.length,

      panelOpen: s.panelOpen,
      panelTitle: 'Select a Location to Restock',
      panelNote: 'Select a bin to restock as the product is at multiple locations.',
      binCount: visibleBinIdxs.length,
      restockDetails: serials.filter(function (x) { return x.status !== '--'; }).length + '/' + ordered,
      panelBins: panelBins,
      showBinProgressCols: !panelLanding,
      panelGridTemplate: panelLanding
        ? '64px 64px 64px 1fr 1fr 100px'
        : '64px 64px 64px 1fr 1fr 1fr 1fr 100px',
      panelLanding: panelLanding, startDisabled: startDisabled, startRestockStyle: startRestockStyle,

      switchModalOpen: s.pendingBinSwitch != null,
      productSwitchModalOpen: s.pendingProductJump != null,
      cancelModalOpen: s.cancelModalOpen,

      toastVisible: !!s.toast, toastMessage: s.toast || '',

      productPanelOpen: s.productPanelOpen,
      productList: productList,
      productCountLabel: String(products.length),
      prodSearch: s.prodSearch, prodStatusFilter: s.prodStatusFilter, prodDoorFilter: s.prodDoorFilter,
      statusFilterOptions: STATUS_FILTER_OPTIONS, doorFilterOptions: doorFilterOptions,
      filterSelectStyle: filterSelectStyle
    };
  }

  RM.view = { build: build };
})(window.RM = window.RM || {});
