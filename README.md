# Restock — Multi Bin

Interactive prototype of the **multi-bin restock** flow for the Ally IQ pharmacy station: a
technician works one product at a time, and each product may live in several bins across several
doors. The prototype covers the whole walk — landing on a bin, actioning serials, saving, moving
between bins and products, and the confirmations that protect unsaved work.

No build step, no dependencies. Plain HTML, CSS and JavaScript.

## Running it

```bash
node serve.js
```

Then open <http://localhost:8412>.

`index.html` also opens fine by double-click; the only thing lost over `file://` is the bundled
Inter webfont, which browsers refuse to load from a local file — the page falls back to the
system sans-serif and everything else behaves identically.

## Layout

```
index.html              page shell — loads the stylesheets, then the scripts in dependency order
css/
  fonts.css             @font-face for the bundled Inter subsets
  ally-tokens.css       Ally UI colour + type foundations (custom properties)
  ally-components.css   Ally UI component styles
  app.css               page-level styles that are not part of the design system
js/
  data.js               products, bins, serial generation, default bin ordering
  store.js              initial state + setState(patch | fn, callback)
  actions.js            every state transition in the flow
  dom.js                escaping, style-object -> inline style
  view.js               derived view model — a pure function of state
  render.js             markup + event delegation
  main.js               boot
fonts/                  Inter woff2 subsets
reference/              the original bundled export this was rebuilt from
serve.js                zero-dependency static server
```

There is no framework. `render.js` builds the entire screen as one HTML string on every state
change and delegates interaction off four listeners on the root, dispatched by `data-act`. Focus
and caret position are restored across renders for any field carrying `data-fkey`, which is what
keeps the editable *Not Received* counter and the product search usable.

## The rules the flow is built on

These are decisions baked into the prototype, not incidental behaviour:

- **Bin ordering.** A product's bins are walked empty-first, then by latest expiration date
  descending. Empty bins have the most room for the newest stock; dispense pulls earliest-expiring
  and restock groups latest-expiring, so the two workflows drive FIFO without the user thinking
  about it.
- **Serials are not pre-assigned.** Every serial is free to go in any bin. A serial only gets a
  location when it is actioned *and* the bin is saved.
- **Committing is explicit.** Editing a status changes nothing durable. *Restock and Continue* (or
  the save branch of a confirmation) commits every actioned serial to the bin the user is standing
  at. Committed serials become read-only for the rest of the transaction and sink to the bottom of
  the table — correction happens via Undo on the History page.
- **Leaving asks.** Switching bin or product with uncommitted edits raises a confirmation: save, or
  discard. Skipping a bin discards its uncommitted edits and moves on.
- **Products remember.** Leaving a product snapshots its serials, locks and position; returning
  restores them. A product whose committed serials don't cover the ordered quantity finalizes as
  *Partial* and can be picked up again.
- **The walk cycles.** Finishing the last product returns to the first, so the flow can be
  demonstrated end to end without a reset.

## Data

Four seeded products (Carboplatin, Avastin, Rituximab, Paclitaxel) with 1–3 bins each, and
generated serial/lot/expiration rows. All of it is fictional sample data in `js/data.js`; there is
no backend and nothing persists across a reload.

## Origin

Rebuilt from `reference/Restock Multi-Bin Prototype.bundle.html`, a self-extracting export whose
markup and logic ran on an internal template runtime. The markup, the Ally UI stylesheets, the
Inter subsets and the flow logic were unpacked from that bundle; the runtime was replaced with the
plain-JavaScript renderer above. Behaviour is intended to match the original.
