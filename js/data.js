/* Restock — Multi Bin · seed data
 *
 * Each product carries its own order info, serial count, and the set of bins it lives in — so
 * counters, the location panel, and the "Available at (N)" list are all per-product.
 */
(function (RM) {
  'use strict';

  var PRODUCTS = [
    {
      title: 'CARBOPLATIN 100 MG/4 ML VIAL', ndc: '11977654321', order: '0282923839',
      source: 'BioCare', badges: ['SDV', 'CLIMATE', 'PACK'], serialCount: 10,
      bins: [
        { door: 1, bin: 32, size: '1×1', exp: '03/2026', inventory: 40 },
        { door: 1, bin: 20, size: '2×2', exp: '01/2026', inventory: 29 },
        { door: 2, bin: 10, size: '1×1', exp: '12/2025', inventory: 0 }
      ]
    },
    {
      title: 'AVASTIN 400 MG/16 ML VIAL', ndc: '11987654321', order: '0328948208',
      source: 'Genentech', badges: ['SDV', 'CLIMATE'], serialCount: 5,
      bins: [
        { door: 2, bin: 10, size: '2×2', exp: '05/2026', inventory: 10 }
      ]
    },
    {
      title: 'RITUXIMAB 500 MG/50 ML VIAL', ndc: '50242005301', order: '0192837465',
      source: 'Biogen', badges: ['MDV', 'CLIMATE', 'PACK'], serialCount: 8,
      bins: [
        { door: 1, bin: 18, size: '2×2', exp: '11/2025', inventory: 22 },
        { door: 3, bin: 4, size: '1×1', exp: '08/2026', inventory: 15 },
        { door: 3, bin: 5, size: '1×1', exp: '04/2026', inventory: 6 }
      ]
    },
    {
      title: 'PACLITAXEL 300 MG/50 ML VIAL', ndc: '55390030450', order: '0473829102',
      source: 'Hospira', badges: ['SDV', 'PACK'], serialCount: 6,
      bins: [
        { door: 3, bin: 7, size: '1×1', exp: '09/2026', inventory: 30 },
        { door: 1, bin: 9, size: '2×2', exp: '01/2026', inventory: 12 }
      ]
    }
  ];

  var LOTS = ['353656', '34583059', '293586344', '243894835', '2384239889', '243894836',
    '2384239890', '243894837', '2384239891', '2384239892'];
  var SERIAL_EXPS = ['02/22/2025', '07/14/2025', '03/10/2025', '12/01/2025', '09/30/2025', '06/18/2025'];

  /* Serials are NOT pre-assigned to a bin — all are free to be split across bins however the
   * user chooses. A serial only gets a location once it's actioned and "Restock and Continue" is
   * clicked; unactioned serials stay available for any bin. Count is per-product. */
  function freshSerials(count) {
    var out = [];
    for (var i = 0; i < count; i++) {
      out.push({
        id: 's' + (i + 1),
        serial: String(2750935803945830 + i * 137911).slice(0, 16),
        lot: LOTS[i % LOTS.length],
        exp: SERIAL_EXPS[i % SERIAL_EXPS.length],
        status: '--'
      });
    }
    return out;
  }

  function expVal(mmYYYY) {
    var p = String(mmYYYY).split('/');
    return (+p[p.length - 1]) * 12 + (+p[0]);
  }

  /* Default landing/cycle order for a product's bins (agreed in review): empty bins first —
   * they have the most room for the newest, latest-expiring stock — then by latest expiration
   * date descending. Dispense pulls earliest-expiring; restock groups latest-expiring; over
   * time the two workflows drive FIFO without the user thinking about it. */
  function defaultBinOrder(bins) {
    return bins.map(function (_, i) { return i; }).sort(function (a, b) {
      var ea = bins[a].inventory === 0, eb = bins[b].inventory === 0;
      if (ea !== eb) return ea ? -1 : 1;
      return expVal(bins[b].exp) - expVal(bins[a].exp);
    });
  }

  RM.data = {
    products: PRODUCTS,
    freshSerials: freshSerials,
    expVal: expVal,
    defaultBinOrder: defaultBinOrder,
    binsAt: function (idx) { return PRODUCTS[idx - 1].bins; }
  };
})(window.RM = window.RM || {});
