/* Tiny DOM helpers. No framework: the app renders a string and hands it to innerHTML, and all
 * interaction is delegated off one listener per event type (see render.js). */
(function (RM) {
  'use strict';

  var AMP = /&/g, LT = /</g, GT = />/g, QUOT = /"/g;

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(AMP, '&amp;').replace(LT, '&lt;').replace(GT, '&gt;').replace(QUOT, '&quot;');
  }

  // Properties that take a raw number in the style objects ported from the prototype.
  var UNITLESS = { fontWeight: 1, lineHeight: 1, zIndex: 1, flex: 1, opacity: 1, flexGrow: 1, flexShrink: 1 };

  function dashed(prop) {
    return prop.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^(webkit|moz|ms)-/, '-$1-');
  }

  /* Style object -> inline style string. Numbers get px unless the property is unitless.
   *
   * The result always lands inside a double-quoted style="" attribute, so a double quote in a
   * value (a url("data:…"), a content string) would close the attribute early and silently drop
   * that declaration and every one after it. Escaping here keeps that impossible; the CSS parser
   * sees the decoded quote either way. */
  function css(obj) {
    if (!obj) return '';
    var text = typeof obj === 'string' ? obj : Object.keys(obj).map(function (k) {
      var v = obj[k];
      if (typeof v === 'number' && !UNITLESS[k]) v = v + 'px';
      return dashed(k) + ':' + v;
    }).join(';');
    return text.replace(QUOT, '&quot;');
  }

  /* Conditional attribute — emits nothing when falsy, so `disabled` never lands as disabled="false". */
  function flag(name, on) { return on ? ' ' + name : ''; }

  RM.esc = esc;
  RM.css = css;
  RM.flag = flag;
})(window.RM = window.RM || {});
