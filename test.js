
const assert = require("node:assert/strict");

const round1 = x =>
  Math.round((x + Number.EPSILON) * 10) / 10;

const round0 = x =>
  Math.round(x + Number.EPSILON);

const ceilSafe = x =>
  Math.ceil(x - 1e-9);

const buys = [
  { q: 10, p: 12 },
  { q: 10, p: 14 }
];

const sells = [
  { q: 8, p: 30 },
  { q: 4, p: 28 }
];

const bq = buys.reduce((a, r) => a + r.q, 0);
const ba = buys.reduce((a, r) => a + r.q * r.p, 0);

const q = sells.reduce((a, r) => a + r.q, 0);
const pq = sells.reduce((a, r) => a + r.q * r.p, 0);

const P = round1(pq / q);
const V = round1(ba / bq + 2);
const M = round1(P - V);

const VQ = round0(V * q);
const MQ = pq - VQ;
const G = MQ - 240;

assert.deepEqual(
  {
    bq, ba, q, pq,
    P, V, M, VQ, MQ, G,
    Q0: ceilSafe(240 / M),
    Qtarget: ceilSafe(290 / M)
  },
  {
    bq: 20,
    ba: 260,
    q: 12,
    pq: 352,
    P: 29.3,
    V: 15,
    M: 14.3,
    VQ: 180,
    MQ: 172,
    G: -68,
    Q0: 17,
    Qtarget: 21
  }
);

console.log("MG Ver.1.9 計算テスト OK");
