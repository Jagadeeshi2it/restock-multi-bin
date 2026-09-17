/* Markup + event wiring.
 *
 * The whole screen re-renders as one HTML string on every state change; interaction is
 * delegated off four listeners on the root, dispatched by data-act. Focus (and the caret) is
 * restored across renders for any field carrying data-fkey, which is what keeps the editable
 * "Not Received" counter and the product search usable through a full re-render. */
(function (RM) {
  'use strict';

  var esc = RM.esc, css = RM.css, flag = RM.flag;
  var A = RM.actions;
  var store = RM.store;

  var root = null;

  /* ---- Static chrome ------------------------------------------------------ */

  var NAV_ITEMS = [
    ['⇄', 'Dispense'], ['▤', 'Order'], ['▣', 'Restock'], ['▥', 'Inventory'],
    ['⬡', 'Formulary'], ['◉', 'Patient'], ['▦', 'Reporting'], ['▭', 'Station'], ['◯', 'User']
  ];
  var ACTIVE_NAV = 'Restock';

  function sidebar() {
    var items = NAV_ITEMS.map(function (it) {
      var active = it[1] === ACTIVE_NAV;
      var style = 'display:flex;flex-direction:column;align-items:center;gap:4px;' +
        (active ? 'background:#173A63;color:#fff;border-radius:8px;padding:8px 6px;' : '');
      return '<div style="' + style + '"><span>' + it[0] + '</span><span>' + esc(it[1]) + '</span></div>';
    }).join('');
    return '' +
      '<div style="width:70px;background:#0E243F;display:flex;flex-direction:column;align-items:center;padding:16px 0;flex-shrink:0;">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:#173A63;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:13px;margin-bottom:24px;">iQ</div>' +
        '<div style="display:flex;flex-direction:column;gap:22px;align-items:center;flex:1;color:#9FB4CE;font-size:10px;font-weight:600;">' + items + '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;color:#4870A1;font-size:9px;padding-bottom:6px;"><div>Help</div><div>V 1.0</div></div>' +
      '</div>';
  }

  function topbar() {
    return '' +
      '<div style="height:56px;border-bottom:1px solid #DADEE3;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:#fff;flex-shrink:0;">' +
        '<div style="display:flex;align-items:center;gap:24px;font-size:14px;color:#465161;">' +
          '<span style="display:flex;align-items:center;gap:8px;color:#095192;font-weight:600;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16h6v-9h-4V9h5a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-6zm-1-2V5H4v14h7zM6 7h3v2H6V7zm0 4h3v2H6v-2zm0 4h3v2H6v-2z"/></svg>' +
            'AllyIQ Practice</span>' +
          '<span style="color:#BCC3CD;">|</span>' +
          '<span style="display:flex;align-items:center;gap:8px;color:#095192;font-weight:500;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.3c3.8-3.5 6-6.6 6-9.8a6 6 0 1 0-12 0c0 3.2 2.2 6.3 6 9.8z"/><circle cx="12" cy="11" r="2.3"/></svg>' +
            'Source Onco Clinic</span>' +
          '<span style="color:#BCC3CD;">|</span>' +
          '<span style="display:flex;align-items:center;gap:8px;color:#095192;font-weight:500;">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-6v2h3v2H7v-2h3v-2H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v9h14V5H5z"/></svg>' +
            'Source Onco Station</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:14px;">' +
          '<div style="text-align:right;">' +
            '<div style="font-size:13px;font-weight:600;">Chloe Test</div>' +
            '<div style="font-size:12px;color:#757575;">Chloe.Test@TXOncology.com</div>' +
          '</div>' +
          '<span style="color:#9FA9B7;font-size:16px;">⏻</span>' +
        '</div>' +
      '</div>';
  }

  /* ---- Product header, counters, table ------------------------------------ */

  function header(v) {
    return '' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<h1 style="font-size:24px;font-weight:600;margin:0;">' + esc(v.productTitle) + '</h1>' +
            '<span style="background:#F5F5F5;color:#465161;font-size:11px;font-weight:600;padding:3px 8px;border-radius:4px;letter-spacing:0.3px;">' + esc(v.productBadge) + '</span>' +
          '</div>' +
          '<div style="font-size:14px;color:#757575;font-style:italic;margin-top:4px;">antihemophilic factor VIII, full length 250 (+/-) unit IV solution</div>' +
        '</div>' +
        (v.hasBin
          ? '<button data-act="onUnlockDoor" style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #095192;color:#095192;font-weight:600;font-size:13px;padding:11px 18px;border-radius:4px;cursor:pointer;letter-spacing:0.3px;">UNLOCK DOOR</button>'
          : '') +
      '</div>';
  }

  function metaGrid(v) {
    return '' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;padding-bottom:22px;border-bottom:1px solid #DADEE3;margin-bottom:22px;font-size:14px;">' +
        '<div style="display:flex;flex-direction:column;gap:11px;">' +
          '<div><span style="color:#757575;">NDC </span><span style="font-weight:600;">' + esc(v.ndcLabel) + '</span></div>' +
          '<div><span style="color:#757575;">Source </span><span style="font-weight:600;">' + esc(v.sourceLabel) + '</span></div>' +
          '<div><span style="color:#757575;">Inventory Type </span><span style="font-weight:600;">Purchased</span></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:11px;">' +
          '<div><span style="color:#757575;">Order Number </span><span style="font-weight:600;">' + esc(v.orderLabel) + '</span></div>' +
          '<div><span style="color:#757575;">Order Date </span><span style="font-weight:600;">12/02/2024</span></div>' +
          '<div><span style="color:#757575;">Reference Number </span><a href="#" data-act="preventDefault">Add Number</a></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:11px;">' +
          '<div><span style="color:#757575;">Door </span><span style="font-weight:600;">' + esc(v.doorLabel) + '</span>' +
          '<span style="color:#757575;margin-left:20px;">Bin </span><span style="font-weight:600;">' + esc(v.binLabel) + '</span></div>' +
          '<div><span style="color:#757575;">Inventory </span><span style="font-weight:600;">' + esc(v.inventoryLabel) + '</span></div>' +
        '</div>' +
      '</div>';
  }

  function counters(v) {
    var nr = v.nrEditing
      ? '<input value="' + esc(v.nrDraft) + '" data-act="onNRInput" data-blur="commitNR" data-key="onNRKey" data-fkey="nr" ' +
        'style="width:70px;font-size:24px;font-weight:600;text-align:right;border:1px solid #095192;border-radius:4px;padding:2px 8px;color:#25282A;">'
      : '<button data-act="startEditNR" title="Edit not received" style="background:none;border:none;cursor:pointer;color:#095192;display:flex;padding:0;">' +
          '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>' +
        '</button>' +
        '<span style="font-size:28px;font-weight:600;">' + v.notReceivedCount + '</span>';

    function cell(label, value, first) {
      return '<div' + (first ? '' : ' style="border-left:1px solid #DADEE3;padding-left:20px;"') + '>' +
        '<div style="font-size:13px;color:#757575;margin-bottom:4px;">' + label + '</div>' +
        '<div style="font-size:28px;font-weight:600;">' + value + '</div></div>';
    }

    return '' +
      '<div style="display:grid;grid-template-columns:repeat(4,150px);gap:20px;padding-bottom:22px;border-bottom:1px solid #DADEE3;margin-bottom:24px;justify-content:flex-end;text-align:right;">' +
        cell('Ordered', v.ordered, true) +
        cell('Restocked', v.restockedCount) +
        cell('Damaged', v.damagedCount) +
        '<div style="border-left:1px solid #DADEE3;padding-left:20px;">' +
          '<div style="font-size:13px;color:#757575;margin-bottom:4px;">Not Received</div>' +
          '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">' + nr + '</div>' +
        '</div>' +
      '</div>';
  }

  var STATUS_OPTIONS = ['--', 'Restocked', 'Damaged', 'Damaged - Require replacement'];

  function statusSelect(row) {
    var options = STATUS_OPTIONS.map(function (o) {
      return '<option value="' + esc(o) + '"' + (o === row.status ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('');
    return '<select data-act="setStatus" data-id="' + esc(row.id) + '"' + flag('disabled', row.selectDisabled) +
      ' style="' + css(row.selectStyle) + '">' + options + '</select>';
  }

  function tableRow(row, v) {
    return '' +
      '<div style="display:grid;grid-template-columns:' + v.gridTemplate + ';padding:14px 20px;align-items:center;border-bottom:1px solid #F5F5F5;font-size:14px;">' +
        '<div>' +
          (row.showCheckmark ? '<span style="color:#008774;font-size:16px;">✓</span>' : '') +
          (row.showCheckbox
            ? '<input type="checkbox" data-act="toggleCheck" data-id="' + esc(row.id) + '"' +
              flag('checked', row.checked) + flag('disabled', row.checkDisabled) + '>'
            : '') +
        '</div>' +
        '<div>' + esc(row.serial) + '</div>' +
        '<div>' + esc(row.lot) + '</div>' +
        '<div>' + esc(row.exp) + '</div>' +
        '<div>' + esc(row.inventory) + '</div>' +
        (v.showLocationColumn
          ? '<div style="white-space:pre-line;color:#465161;font-size:13px;">' + esc(row.locationText) + '</div>'
          : '') +
        '<div>' +
          (row.showStatusText
            ? '<span style="' + css(row.statusTextStyle) + '">' + esc(row.status) + '</span>'
            : '') +
          (row.showSelect ? statusSelect(row) : '') +
        '</div>' +
      '</div>';
  }

  function serialTable(v) {
    return '' +
      '<div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
          '<div style="display:flex;gap:12px;">' +
            '<input placeholder="Search or scan" style="width:280px;padding:10px 14px;border:1px solid #BCC3CD;border-radius:8px;font-size:14px;">' +
            '<button style="padding:10px 16px;border:1px solid #BCC3CD;border-radius:8px;background:#fff;font-weight:600;font-size:13px;color:#465161;cursor:pointer;letter-spacing:0.3px;">ADD MANUALLY</button>' +
          '</div>' +
          '<div style="display:flex;gap:12px;">' +
            '<button data-act="onRestockSelected"' + flag('disabled', v.restockSelectedDisabled) + ' style="' + css(v.restockSelectedStyle) + '">✓ RESTOCK SELECTED</button>' +
            '<button data-act="onResetSelected"' + flag('disabled', v.resetSelectedDisabled) + ' style="' + css(v.resetSelectedStyle) + '">↺ RESET SELECTED</button>' +
          '</div>' +
        '</div>' +
        '<div style="border:1px solid #DADEE3;border-radius:10px;overflow:hidden;background:#fff;">' +
          '<div style="display:grid;grid-template-columns:' + v.gridTemplate + ';padding:12px 20px;background:#F7F8F9;border-bottom:1px solid #DADEE3;font-size:12px;color:#757575;font-weight:600;letter-spacing:0.3px;align-items:center;">' +
            '<div><input type="checkbox" data-act="toggleCheckAll"' + flag('checked', v.allChecked) + flag('disabled', v.selectAllDisabled) + '></div>' +
            '<div>SERIAL</div><div>LOT</div><div>EXPIRATION</div><div>INVENTORY</div>' +
            (v.showLocationColumn ? '<div>LOCATION RESTOCKED</div>' : '') +
            '<div>STATUS</div>' +
          '</div>' +
          v.rows.map(function (r) { return tableRow(r, v); }).join('') +
        '</div>' +
      '</div>';
  }

  function emptyState() {
    return '' +
      '<div style="border:1px dashed #BCC3CD;border-radius:10px;padding:60px 24px;text-align:center;background:#fff;">' +
        '<div style="font-size:16px;font-weight:600;color:#465161;margin-bottom:6px;">No bin selected</div>' +
        '<div style="font-size:14px;color:#9FA9B7;">Click <span style="color:#465161;font-weight:600;">Select location</span> in the footer to choose a bin and start restocking this product.</div>' +
      '</div>';
  }

  /* ---- Footer ------------------------------------------------------------- */

  function footer(v) {
    var chev = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#095192" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:12px;"><path d="m9 6 6 6-6 6"/></svg>';
    function stat(icon, label, value) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:0 24px;">' + icon +
        '<div><div style="font-size:12px;color:#757575;line-height:16px;">' + label + '</div>' +
        '<div style="font-size:18px;font-weight:600;color:#25282A;line-height:22px;">' + esc(value) + '</div></div></div>';
    }
    return '' +
      '<div style="position:absolute;left:0;right:0;bottom:0;height:64px;background:#fff;border-top:1px solid #DADEE3;display:flex;align-items:center;justify-content:space-between;padding:0 32px;">' +
        '<div style="display:flex;align-items:stretch;height:100%;">' +
          '<div data-act="openProductPanel" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:0 24px 0 0;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#465161" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16"/><path d="M5.5 9v6"/></svg>' +
            '<div><div style="font-size:12px;color:#757575;line-height:16px;">Product</div>' +
            '<div style="font-size:18px;font-weight:600;color:#25282A;line-height:22px;">' + esc(v.footerProductLabel) + '</div></div>' + chev +
          '</div>' +
          '<div style="width:1px;background:#DADEE3;"></div>' +
          '<div data-act="onOpenPanelEv" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:0 24px;">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#465161" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.6-8 12-8 12s-8-7.4-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.6"/></svg>' +
            '<div><div style="font-size:12px;color:#757575;line-height:16px;">Location</div>' +
            '<div style="font-size:18px;font-weight:600;color:#25282A;line-height:22px;">' + esc(v.footerBinLabel) + '</div></div>' + chev +
          '</div>' +
          '<div style="width:1px;background:#DADEE3;"></div>' +
          stat('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#008774" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/></svg>',
            'Restocked', v.footerRestockedCount) +
          '<div style="width:1px;background:#DADEE3;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:12px;">' +
          '<button data-act="onOpenCancel" style="padding:11px 20px;border:1px solid #BCC3CD;border-radius:4px;background:#fff;font-weight:600;font-size:13px;color:#465161;cursor:pointer;letter-spacing:0.3px;">CANCEL</button>' +
          '<button data-act="onSkip"' + flag('disabled', v.skipDisabled) + ' style="' + css(v.skipStyle) + '">' + esc(v.skipLabel) + '</button>' +
          '<button data-act="onRestockContinue"' + flag('disabled', v.restockContinueDisabled) + ' style="' + css(v.restockContinueBtnStyle) + '">' + esc(v.restockContinueLabel) + '</button>' +
        '</div>' +
      '</div>';
  }

  /* ---- Location side panel ------------------------------------------------ */

  function locationPanel(v) {
    if (!v.panelOpen) return '';
    var rows = v.panelBins.map(function (b) {
      return '' +
        '<div style="display:grid;grid-template-columns:' + v.panelGridTemplate + ';padding:14px 16px;align-items:center;font-size:14px;border-bottom:1px solid #F5F5F5;">' +
          '<div>' + b.door + '</div><div>' + b.bin + '</div><div>' + esc(b.size) + '</div>' +
          '<div>' + esc(b.exp) + '</div><div>' + b.inventory + '</div>' +
          (v.showBinProgressCols ? '<div>' + esc(b.restocked) + '</div><div>' + esc(b.damaged) + '</div>' : '') +
          '<div style="text-align:right;">' +
            (b.showCheck
              ? '<input type="checkbox" data-act="toggleBinCheck" data-index="' + b.index + '"' + flag('checked', b.checkedBin) + '>'
              : '') +
            (b.viewOnly
              ? '<span' + (b.actionDisabled ? '' : ' data-act="selectBin" data-index="' + b.index + '"') +
                ' style="' + css(b.actionStyle) + '">' + esc(b.actionLabel) + '</span>'
              : '') +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="position:fixed;inset:0;background:rgba(15,23,42,0.35);z-index:40;display:flex;justify-content:flex-end;">' +
        '<div style="width:760px;max-width:92vw;height:100%;background:#fff;box-shadow:-8px 0 24px rgba(0,0,0,0.08);display:flex;flex-direction:column;">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:28px 32px 20px;border-bottom:1px solid #DADEE3;">' +
            '<div>' +
              '<h2 style="font-size:22px;font-weight:600;margin:0 0 14px;">' + esc(v.panelTitle) + '</h2>' +
              '<div style="font-size:15px;font-weight:600;">' + esc(v.productTitle) + '</div>' +
              '<div style="font-size:13px;color:#757575;font-style:italic;">antihemophilic factor VIII, full length 250 (+/-) unit IV solution</div>' +
            '</div>' +
            '<button data-act="closePanel" style="background:none;border:none;font-size:22px;color:#9FA9B7;cursor:pointer;">×</button>' +
          '</div>' +
          '<div style="padding:24px 32px;overflow-y:auto;flex:1;">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:16px;margin-bottom:24px;font-size:14px;">' +
              '<div><div style="color:#757575;margin-bottom:4px;">NDC</div><div style="font-weight:600;">' + esc(v.ndcLabel) + '</div></div>' +
              '<div><div style="color:#757575;margin-bottom:4px;">Source</div><div style="font-weight:600;">' + esc(v.sourceLabel) + '</div></div>' +
              '<div><div style="color:#757575;margin-bottom:4px;">Order Number</div><div style="font-weight:600;">' + esc(v.orderLabel) + '</div></div>' +
              '<div><div style="color:#757575;margin-bottom:4px;">Restock Details</div><div style="font-weight:600;">' + esc(v.restockDetails) + '</div></div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;background:#EFE0FE;color:#9D5BE0;padding:14px 16px;border-radius:8px;font-size:14px;margin-bottom:24px;">' +
              '<span>ⓘ</span><span>' + esc(v.panelNote) + '</span>' +
            '</div>' +
            '<div style="font-size:14px;font-weight:600;margin-bottom:12px;">Available at (' + v.binCount + ')</div>' +
            '<div style="border:1px solid #DADEE3;border-radius:10px;overflow:hidden;">' +
              '<div style="display:grid;grid-template-columns:' + v.panelGridTemplate + ';padding:12px 16px;background:#F7F8F9;font-size:12px;color:#757575;font-weight:600;border-bottom:1px solid #DADEE3;">' +
                '<div>Door</div><div>Bin</div><div>Size</div><div>Latest Expiration</div><div>Inventory</div>' +
                (v.showBinProgressCols ? '<div>Restocked</div><div>Damaged</div>' : '') +
                '<div></div>' +
              '</div>' + rows +
            '</div>' +
          '</div>' +
          '<div style="padding:20px 32px;border-top:1px solid #DADEE3;display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
            '<div style="display:flex;gap:12px;margin-left:auto;">' +
              '<button data-act="closePanel" style="padding:10px 22px;border:1px solid #095192;color:#095192;border-radius:4px;background:#fff;font-weight:600;font-size:13px;cursor:pointer;letter-spacing:0.3px;">CLOSE</button>' +
              (v.panelLanding
                ? '<button data-act="onStartGuided"' + flag('disabled', v.startDisabled) + ' style="' + css(v.startRestockStyle) + '">CONFIRM</button>'
                : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---- Product lineup side panel ------------------------------------------ */

  function selectEl(act, value, options, style) {
    var opts = options.map(function (o) {
      return '<option value="' + esc(o) + '"' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('');
    return '<select data-act="' + act + '" style="' + css(style) + '">' + opts + '</select>';
  }

  function productPanel(v) {
    if (!v.productPanelOpen) return '';
    var cards = v.productList.map(function (p) {
      return '' +
        '<div data-act="jumpToProduct" data-index="' + p.idx + '" style="' + css(p.cardStyle) + '">' +
          '<div style="min-width:0;">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
              '<span style="font-size:15px;font-weight:600;">' + esc(p.title) + '</span>' +
              '<span style="' + css(p.badgeStyle) + '">' + esc(p.badge) + '</span>' +
            '</div>' +
            '<div style="font-size:13px;color:#757575;">NDC ' + esc(p.ndc) + ' &nbsp;·&nbsp; ' + esc(p.locationText) + '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:14px;flex-shrink:0;">' +
            '<span style="' + css(p.statusStyle) + '">' + esc(p.statusLabel) + '</span>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<div style="position:fixed;inset:0;background:rgba(15,23,42,0.35);z-index:50;display:flex;justify-content:flex-end;">' +
        '<div style="width:640px;max-width:92vw;height:100%;background:#fff;box-shadow:-8px 0 24px rgba(0,0,0,0.08);display:flex;flex-direction:column;">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:28px 32px 18px;border-bottom:1px solid #DADEE3;">' +
            '<div><h2 style="font-size:22px;font-weight:600;margin:0;">Products to restock (' + esc(v.productCountLabel) + ')</h2></div>' +
            '<button data-act="closeProductPanel" style="background:none;border:none;font-size:22px;color:#9FA9B7;cursor:pointer;">×</button>' +
          '</div>' +
          '<div style="padding:18px 32px;border-bottom:1px solid #F5F5F5;display:flex;gap:12px;align-items:center;">' +
            '<input value="' + esc(v.prodSearch) + '" data-act="onProdSearch" data-fkey="prodSearch" placeholder="Search product or NDC" style="flex:1;padding:9px 12px;border:1px solid #BCC3CD;border-radius:8px;font-size:14px;">' +
            selectEl('onProdStatusFilter', v.prodStatusFilter, v.statusFilterOptions, v.filterSelectStyle) +
            selectEl('onProdDoorFilter', v.prodDoorFilter, v.doorFilterOptions, v.filterSelectStyle) +
          '</div>' +
          '<div style="padding:20px 32px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px;">' + cards + '</div>' +
          '<div style="padding:20px 32px;border-top:1px solid #DADEE3;display:flex;justify-content:flex-end;">' +
            '<button data-act="closeProductPanel" style="padding:10px 22px;border:1px solid #095192;color:#095192;border-radius:4px;background:#fff;font-weight:600;font-size:13px;cursor:pointer;letter-spacing:0.3px;">CLOSE</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---- Modals & toast ----------------------------------------------------- */

  function modal(opts) {
    return '' +
      '<div style="position:fixed;inset:0;background:rgba(15,23,42,0.35);z-index:70;display:flex;align-items:center;justify-content:center;padding:24px;">' +
        '<div style="width:' + opts.width + 'px;max-width:94vw;background:#fff;border-radius:10px;box-shadow:0 20px 48px rgba(11,42,74,0.24);padding:28px 30px 24px;">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;">' +
            '<h2 style="font-size:20px;font-weight:600;margin:0;color:#25282A;">' + esc(opts.title) + '</h2>' +
            '<button data-act="' + opts.dismiss + '" style="background:none;border:none;font-size:22px;line-height:1;color:#9FA9B7;cursor:pointer;padding:0;">×</button>' +
          '</div>' +
          '<div style="font-size:15px;color:#465161;line-height:1.5;margin-bottom:28px;">' + esc(opts.body) + '</div>' +
          '<div style="display:flex;justify-content:flex-end;gap:12px;">' +
            '<button data-act="' + opts.secondaryAct + '" style="padding:12px 22px;border:1px solid #095192;border-radius:4px;background:#fff;color:#095192;font-weight:600;font-size:13px;letter-spacing:0.3px;cursor:pointer;">' + esc(opts.secondary) + '</button>' +
            '<button data-act="' + opts.primaryAct + '" style="padding:12px 22px;border:1px solid #095192;border-radius:4px;background:#095192;color:#fff;font-weight:600;font-size:13px;letter-spacing:0.3px;cursor:pointer;">' + esc(opts.primary) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function modals(v) {
    var out = '';
    if (v.cancelModalOpen) {
      out += modal({
        width: 600, title: 'Are you sure?', dismiss: 'onCloseCancel',
        body: 'There are some products that still need to be restocked. If you close any remaining products will be ignored.',
        secondary: 'NO, STAY', secondaryAct: 'onCloseCancel',
        primary: 'YES, CONTINUE', primaryAct: 'onConfirmCancel'
      });
    }
    if (v.switchModalOpen) {
      out += modal({
        width: 560, title: 'Save changes to this bin?', dismiss: 'onCancelSwitch',
        body: "You've made some changes in the current bin. Do you want to save them before switching, or discard them?",
        secondary: 'DISCARD CHANGES', secondaryAct: 'onDiscardSwitch',
        primary: 'RESTOCK AND CONTINUE', primaryAct: 'onSaveSwitch'
      });
    }
    if (v.productSwitchModalOpen) {
      out += modal({
        width: 560, title: 'Save changes to this product?', dismiss: 'onCancelProductJump',
        body: "You've made some changes to this product. Do you want to save them before switching, or discard them?",
        secondary: 'DISCARD CHANGES', secondaryAct: 'onDiscardProductJump',
        primary: 'RESTOCK AND CONTINUE', primaryAct: 'onSaveProductJump'
      });
    }
    return out;
  }

  function toast(v) {
    if (!v.toastVisible) return '';
    return '' +
      '<div style="position:fixed;top:20px;right:32px;background:#D9F2EF;border:1px solid #00A991;color:#25282A;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:10px;z-index:60;box-shadow:0 4px 12px rgba(0,0,0,0.08);animation:toastIn 0.2s ease-out;">' +
        '<span style="color:#008774;">✓</span><span>' + esc(v.toastMessage) + '</span>' +
        '<button data-act="onCloseToast" style="background:none;border:none;color:#25282A;cursor:pointer;font-size:14px;margin-left:8px;">×</button>' +
      '</div>';
  }

  /* ---- Page --------------------------------------------------------------- */

  function page(v) {
    return '' +
      '<div style="display:flex;height:100vh;width:100%;font-family:var(--font-sans);background:#F7F8F9;color:#25282A;overflow:hidden;">' +
        sidebar() +
        '<div style="flex:1;display:flex;flex-direction:column;min-width:0;position:relative;">' +
          topbar() +
          '<div style="flex:1;overflow-y:auto;padding:28px 32px 90px;">' +
            header(v) + metaGrid(v) + counters(v) +
            (v.hasBin ? serialTable(v) : emptyState()) +
          '</div>' +
          footer(v) +
          locationPanel(v) +
          productPanel(v) +
          modals(v) +
          toast(v) +
        '</div>' +
      '</div>';
  }

  /* ---- Dispatch ----------------------------------------------------------- */

  // Clicks: data-act -> handler. Row-scoped handlers read data-id / data-index.
  var CLICK = {
    preventDefault: function (e) { e.preventDefault(); },
    onUnlockDoor: A.onUnlockDoor,
    startEditNR: A.startEditNR,
    onRestockSelected: A.onRestockSelected,
    onResetSelected: A.onResetSelected,
    onOpenCancel: A.onOpenCancel,
    onCloseCancel: A.onCloseCancel,
    onConfirmCancel: A.onConfirmCancel,
    onSkip: A.onSkip,
    onRestockContinue: A.onRestockContinue,
    onOpenPanelEv: A.onOpenPanelEv,
    closePanel: A.closePanel,
    onStartGuided: A.onStartGuided,
    openProductPanel: A.openProductPanel,
    closeProductPanel: A.closeProductPanel,
    onCancelSwitch: A.onCancelSwitch,
    onDiscardSwitch: A.onDiscardSwitch,
    onSaveSwitch: A.onSaveSwitch,
    onCancelProductJump: A.onCancelProductJump,
    onDiscardProductJump: A.onDiscardProductJump,
    onSaveProductJump: A.onSaveProductJump,
    onCloseToast: A.onCloseToast,
    selectBin: function (e, el) { A.selectBin(Number(el.getAttribute('data-index'))); },
    jumpToProduct: function (e, el) { A.jumpToProduct(Number(el.getAttribute('data-index'))); }
  };

  // Change: checkboxes and selects.
  var CHANGE = {
    toggleCheck: function (e, el) { A.toggleCheck(el.getAttribute('data-id')); },
    toggleCheckAll: A.toggleCheckAll,
    toggleBinCheck: function (e, el) { A.toggleBinCheck(Number(el.getAttribute('data-index'))); },
    setStatus: function (e, el) { A.setStatus(el.getAttribute('data-id'), el.value); },
    onProdStatusFilter: A.setProdFilter('prodStatusFilter'),
    onProdDoorFilter: A.setProdFilter('prodDoorFilter')
  };

  // Input: live-typed fields.
  var INPUT = {
    onNRInput: A.onNRInput,
    onProdSearch: A.setProdFilter('prodSearch')
  };

  function closestAct(target) {
    var el = target;
    while (el && el !== root) {
      if (el.getAttribute && el.getAttribute('data-act')) return el;
      el = el.parentNode;
    }
    return null;
  }

  function dispatch(table, e) {
    // Tearing down the old tree makes the browser fire blur/change at whatever was focused.
    // Those are an artifact of rendering, not user intent, so they never reach a handler.
    if (rendering) return;
    var el = closestAct(e.target);
    if (!el) return;
    var fn = table[el.getAttribute('data-act')];
    if (fn) fn(e, el);
  }

  /* Re-rendering replaces every node, so remember which field was focused and put the caret
   * back where it was. */
  function snapshotFocus() {
    var el = document.activeElement;
    if (!el || !el.getAttribute || !el.getAttribute('data-fkey')) return null;
    return { key: el.getAttribute('data-fkey'), start: el.selectionStart, end: el.selectionEnd };
  }

  function restoreFocus(snap, v) {
    var key = snap ? snap.key : (v.nrEditing ? 'nr' : null);
    if (!key) return;
    var el = root.querySelector('[data-fkey="' + key + '"]');
    if (!el) return;
    el.focus();
    if (snap && snap.start != null) {
      try { el.setSelectionRange(snap.start, snap.end); } catch (err) { /* type has no selection */ }
    } else if (el.setSelectionRange) {
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }

  // Replacing innerHTML blurs whatever was focused. That is not the user leaving the field, so
  // handlers sit out anything the browser fires while a render is in flight (see dispatch).
  var rendering = false;
  var restatedDuringRender = false;

  function render() {
    // A state change raised from inside a render would otherwise re-enter innerHTML on a tree
    // that is mid-teardown; coalesce it into one more pass once this one unwinds.
    if (rendering) { restatedDuringRender = true; return; }
    rendering = true;
    try {
      do {
        restatedDuringRender = false;
        var v = RM.view.build(store.state);
        var snap = snapshotFocus();
        root.innerHTML = page(v);
        restoreFocus(snap, v);
      } while (restatedDuringRender);
    } finally {
      rendering = false;
    }
  }

  function mount(el) {
    root = el;
    root.addEventListener('click', function (e) { dispatch(CLICK, e); });
    root.addEventListener('change', function (e) { dispatch(CHANGE, e); });
    root.addEventListener('input', function (e) { dispatch(INPUT, e); });
    root.addEventListener('blur', function (e) {
      if (rendering) return;
      var el = closestAct(e.target);
      if (el && el.getAttribute('data-blur') === 'commitNR') A.commitNR();
    }, true);
    root.addEventListener('keydown', function (e) {
      var el = closestAct(e.target);
      if (el && el.getAttribute('data-key') === 'onNRKey') A.onNRKey(e);
    });
    store.subscribe(render);
    render();
  }

  RM.mount = mount;
})(window.RM = window.RM || {});
