// ─── Min-Heap Priority Queue ─────────────────────────────────────────────────
// Replaces the O(n log n) Array.sort on every A* iteration with O(log n) push/pop
class MinHeap {
  constructor() { this.data = []; }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length) { this.data[0] = last; this._sinkDown(0); }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].f <= this.data[i].f) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function itemById(id) {
  return state.inventory.find((item) => item.id === id);
}

function selectedOrder() {
  return state.orders.find((order) => order.id === state.selectedOrderId) || state.orders[0];
}

// ─── Route Building ───────────────────────────────────────────────────────────
function buildRoute(order, algorithm) {
  const start = { x: 0, y: 0 };
  const picks = order.items
    .map((line) => itemById(line.itemId))
    .filter(Boolean)
    .map((item) => ({ x: item.x, y: item.y }));

  if (!picks.length) return { algorithm: "N/A", order: [], path: [], distance: 0, baselineDistance: 0, savings: 0 };

  const orderSequence = algorithm === "greedy"
    ? greedyOrder(start, picks)
    : optimizedOrder(start, picks, algorithm);

  const pathAlgo = algorithm === "dijkstra" ? "dijkstra" : "astar";
  const baseline = routeForSequence(start, picks, pathAlgo);
  const optimized = routeForSequence(start, orderSequence, pathAlgo);
  const savings = baseline.distance
    ? Math.max(0, Math.round((1 - optimized.distance / baseline.distance) * 100))
    : 0;

  return {
    algorithm:
      algorithm === "astar" ? "A* shortest path + optimized ordering" :
      algorithm === "dijkstra" ? "Dijkstra shortest path + optimized ordering" :
      "Greedy batching nearest-neighbor route",
    order: orderSequence,
    path: optimized.path,
    distance: optimized.distance,
    baselineDistance: baseline.distance,
    savings
  };
}

function optimizedOrder(start, picks, algorithm) {
  const remaining = [...picks];
  const ordered = [];
  let current = start;
  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    remaining.forEach((point, index) => {
      const result = shortestPath(current, point, algorithm);
      if (result.distance < bestDistance) {
        bestDistance = result.distance;
        bestIndex = index;
      }
    });
    current = remaining.splice(bestIndex, 1)[0];
    ordered.push(current);
  }
  return ordered;
}

function greedyOrder(start, picks) {
  return optimizedOrder(start, picks, "astar");
}

function routeForSequence(start, sequence, algorithm) {
  let current = start;
  let distance = 0;
  let path = [start];
  sequence.forEach((point) => {
    const leg = shortestPath(current, point, algorithm);
    distance += leg.distance;
    path = path.concat(leg.path.slice(1));
    current = point;
  });
  const returnLeg = shortestPath(current, start, algorithm);
  distance += returnLeg.distance;
  path = path.concat(returnLeg.path.slice(1));
  return { distance, path };
}

// ─── A* / Dijkstra with Min-Heap ─────────────────────────────────────────────
function shortestPath(start, goal, algorithm) {
  const blocked = new Set(state.blocked.map((p) => `${p.x},${p.y}`));
  const startKey = `${start.x},${start.y}`;
  const open = new MinHeap();
  open.push({ x: start.x, y: start.y, g: 0, f: heuristic(start, goal), key: startKey });
  const cameFrom = new Map();
  const costs = new Map([[startKey, 0]]);
  const visited = new Set();

  while (open.size) {
    const current = open.pop();
    if (current.x === goal.x && current.y === goal.y) {
      return reconstruct(cameFrom, current, costs.get(current.key));
    }
    if (visited.has(current.key)) continue;
    visited.add(current.key);

    for (const next of neighbors(current)) {
      const key = `${next.x},${next.y}`;
      if (blocked.has(key)) continue;
      const nextCost = costs.get(current.key) + 1;
      if (!costs.has(key) || nextCost < costs.get(key)) {
        costs.set(key, nextCost);
        cameFrom.set(key, current.key);
        const h = algorithm === "dijkstra" ? 0 : heuristic(next, goal);
        open.push({ x: next.x, y: next.y, g: nextCost, f: nextCost + h, key });
      }
    }
  }
  return { distance: Infinity, path: [start] };
}

function neighbors(point) {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 }
  ].filter((p) => p.x >= 0 && p.x < 12 && p.y >= 0 && p.y < 8);
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstruct(cameFrom, current, distance) {
  const path = [{ x: current.x, y: current.y }];
  let key = current.key;
  while (cameFrom.has(key)) {
    key = cameFrom.get(key);
    const [x, y] = key.split(",").map(Number);
    path.unshift({ x, y });
  }
  return { distance, path };
}

// ─── CSV Export Utility ───────────────────────────────────────────────────────
function exportCSV(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
