# Veyra Fulfillment OS

Veyra Fulfillment OS is a browser-based warehouse fulfillment platform created for Tyler Momani. It demonstrates a modern warehouse management experience with role-based access, scanner receiving, inventory control, order fulfillment, warehouse mapping, route optimization, and executive oversight.

## Run The Project

Open `index.html` in a browser, or run a local static server from this folder:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:4173/index.html
```

## Login Accounts

| Role | Email | Password |
| --- | --- | --- |
| Owner | owner@veyra.test | owner123 |
| Manager | manager@fulfilliq.test | manager123 |
| Warehouse Worker | worker@fulfilliq.test | worker123 |

## Role Access

Owner access is reserved for Tyler Momani. The owner can use executive controls, change operating mode, run audit checkpoints, view the access matrix, access the database design, and oversee all warehouse functions.

Managers can release optimized waves, rebalance labor, approve replenishment, manage inventory, review database structure, and monitor fulfillment execution.

Warehouse workers have focused floor-level access: receiving scans, order status updates, route-guided picking, and inventory visibility. Workers cannot access the Database, Manager Console, or Owner Command areas.

## Core Features

- Secure login/logout with JWT-style session claims.
- Role-based permission controls for owner, manager, and warehouse worker.
- Inventory management with SKU generation, quantities, reorder thresholds, aisle/bin locations, barcodes, suppliers, and velocity classes.
- Scanner receiving workflow for new SKU intake, duplicate barcode detection, stock-in actions, quality hold, and putaway queue creation.
- Order management with pick tickets, assignees, and status tracking from pending to shipped.
- Warehouse map with coordinate bins, blocked zones, heat map overlays, and pick route visualization.
- Route optimization using A*, Dijkstra, greedy batching, optimized pick ordering, multi-item routing, and walking distance reduction.
- Manager Console for wave release, labor balancing, and replenishment approvals.
- Owner Command for Tyler-only system controls, audit checkpoints, and executive visibility.
- Dashboard with inventory totals, active orders, pick efficiency, inbound receiving, replenishment signals, slotting suggestions, SLA risk, and wave batching insights.
- Database design view with relational schema, foreign keys, indexes, receiving queue, and transaction log concepts.

## Data Storage

This MVP stores data in browser `localStorage` under:

```text
veyra_fulfillment_os_state_v3
```

Clear that key in the browser to reset seeded data.

## Project Structure

```text
index.html
styles.css
app.js
js/
  data.js
  shell.js
  dashboard.js
  inventory.js
  receiving.js
  orders.js
  map-admin.js
  database.js
  routing.js
  controllers.js
```

`app.js` is now only the bootstrap file. Feature code is separated by responsibility so inventory, orders, routing, role consoles, database views, and controller logic are easier to maintain.
