
"use strict";

// ======================================
// MG Dashboard Ver.1.9
// ======================================

const STORAGE_KEY = "mg-dashboard-v1.9";

// 初期データ
const initial = () => ({
  buys: [
    { id: 1, q: "10", p: "12" },
    { id: 2, q: "10", p: "14" }
  ],
  sells: [
    { id: 1, q: "8", p: "30" },
    { id: 2, q: "4", p: "28" }
  ],
  fixed: "240",
  goal: "50"
});

let state = initial();
let nextId = 3;

const $ = id => document.getElementById(id);

// 数値チェック
const number = x =>
  x !== "" &&
  x !== null &&
  Number.isFinite(Number(x)) &&
  Number(x) >= 0
    ? Number(x)
    : null;

const signedNumber = x =>
  x !== "" &&
  x !== null &&
  Number.isFinite(Number(x))
    ? Number(x)
    : null;

const rowValid = r =>
  number(r.q) !== null &&
  Number.isInteger(number(r.q)) &&
  number(r.p) !== null;

// 合計計算
const sumQ = rows =>
  rows.reduce((n, r) => n + Number(r.q), 0);

const sumA = rows =>
  rows.reduce(
    (n, r) => n + Number(r.q) * Number(r.p),
    0
  );

// 端数処理
const round1 = n =>
  Math.round((n + Number.EPSILON) * 10) / 10;

const round0 = n =>
  Math.round(n + Number.EPSILON);

const ceilSafe = n =>
  Math.ceil(n - 1e-9);

// 表示形式
const fmt = n =>
  n === null
    ? "—"
    : n.toLocaleString("ja-JP", {
        maximumFractionDigits: 0
      });

const fmt1 = n =>
  n === null
    ? "—"
    : n.toLocaleString("ja-JP", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });

// ======================================
// MG中間決算 計算エンジン
// ======================================

function calculate(s) {
  const buyValid = s.buys.every(rowValid);
  const sellValid = s.sells.every(rowValid);

  const bq = buyValid ? sumQ(s.buys) : null;
  const sq = sellValid ? sumQ(s.sells) : null;

  const ba = buyValid ? sumA(s.buys) : null;
  const pq = sellValid ? sumA(s.sells) : null;

  // P：実際の売上高 ÷ 販売数量
  const P = sq > 0
    ? round1(pq / sq)
    : null;

  // V：材料平均単価 ＋ 完投費用2円
  const V = bq > 0
    ? round1(ba / bq + 2)
    : null;

  // M：単位当たり付加価値
  const M = P !== null && V !== null
    ? round1(P - V)
    : null;

  // VQ：小数第1位のV × 販売数量
  // 整数に四捨五入
  const vq = V !== null && sq !== null
    ? round0(V * sq)
    : null;

  // PQは実際の売上合計を使用
  const mq = pq !== null && vq !== null
    ? pq - vq
    : null;

  const F = number(s.fixed);
  const goal = signedNumber(s.goal);

  // 利益
  const G = mq !== null && F !== null
    ? mq - F
    : null;

  // 損益分岐点
  const q0 = M !== null && M > 0 && F !== null
    ? ceilSafe(F / M)
    : null;

  // 目標達成に必要な累計販売数量
  const qt =
    M !== null &&
    M > 0 &&
    F !== null &&
    goal !== null
      ? ceilSafe((F + goal) / M)
      : null;

  // 現在Qとの差
  const q0Left =
    q0 !== null && sq !== null
      ? Math.max(0, q0 - sq)
      : null;

  const qtLeft =
    qt !== null && sq !== null
      ? Math.max(0, qt - sq)
      : null;

  return {
    bq, sq, ba, pq,
    P, V, M,
    vq, mq, F, G,
    goal, q0, qt,
    q0Left, qtLeft
  };
}

// ======================================
// ブラウザ内保存
// ======================================

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );

    $("save-status").textContent =
      "この端末に自動保存済み";
  } catch (e) {
    $("save-status").textContent =
      "自動保存できません";
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const s = JSON.parse(raw);

    if (
      !s ||
      !Array.isArray(s.buys) ||
      !Array.isArray(s.sells) ||
      !s.buys.length ||
      !s.sells.length
    ) return;

    const good = rows =>
      rows.every(r =>
        r &&
        Number.isInteger(r.id) &&
        r.id > 0 &&
        typeof r.q === "string" &&
        typeof r.p === "string"
      );

    if (
      !good(s.buys) ||
      !good(s.sells) ||
      typeof s.fixed !== "string" ||
      typeof s.goal !== "string"
    ) return;

    state = s;

    nextId = Math.max(
      ...s.buys.map(r => r.id),
      ...s.sells.map(r => r.id)
    ) + 1;
  } catch (e) {
    // 保存データが壊れていれば初期値を使用
  }
}

// ======================================
// 入力明細の作成
// ======================================

function rowList(kind) {
  const target = $(
    kind === "buys" ? "buy-rows" : "sell-rows"
  );

  target.replaceChildren();

  state[kind].forEach(r => {
    const div = document.createElement("div");
    div.className = "entry-row";

    for (const field of ["q", "p"]) {
      const input = document.createElement("input");

      input.type = "number";
      input.min = "0";
      input.step = field === "q" ? "1" : "any";
      input.inputMode =
        field === "q" ? "numeric" : "decimal";

      input.value = r[field];

      input.setAttribute(
        "aria-label",
        `${kind === "buys" ? "材料購入" : "販売"}${
          field === "q" ? "数量" : "単価"
        }`
      );

      input.addEventListener("input", () => {
        r[field] = input.value;

        const invalid =
          number(input.value) === null ||
          (
            field === "q" &&
            !Number.isInteger(number(input.value))
          );

        input.classList.toggle("invalid", invalid);
        refresh();
      });

      div.append(input);
    }

    // 明細金額
    const money = document.createElement("span");
    money.className = "amount";
    money.dataset.amount = String(r.id);

    money.textContent = rowValid(r)
      ? fmt(Number(r.q) * Number(r.p))
      : "—";

    div.append(money);

    // 削除ボタン
    const del = document.createElement("button");
    del.type = "button";
    del.className = "remove";
    del.textContent = "×";
    del.title = "行を削除";
    del.setAttribute("aria-label", "この行を削除");

    del.disabled = state[kind].length === 1;

    del.addEventListener("click", () => {
      state[kind] = state[kind].filter(
        x => x.id !== r.id
      );

      renderRows();
      refresh();
    });

    div.append(del);
    target.append(div);
  });
}

function renderRows() {
  rowList("buys");
  rowList("sells");
}

// ======================================
// ダッシュボード更新
// ======================================

function refresh() {
  const c = calculate(state);

  // 明細ごとの金額更新
  for (const kind of ["buys", "sells"]) {
    const list = $(
      kind === "buys" ? "buy-rows" : "sell-rows"
    );

    [...list.querySelectorAll(".amount")].forEach(el => {
      const r = state[kind].find(
        x => String(x.id) === el.dataset.amount
      );

      el.textContent = rowValid(r)
        ? fmt(Number(r.q) * Number(r.p))
        : "—";
    });
  }

  // 整数表示
  const data = {
    "buy-q": c.bq,
    "buy-a": c.ba,
    "sell-q": c.sq,
    "sell-a": c.pq,
    "q": c.sq,
    "pq": c.pq,
    "vq": c.vq,
    "mq": c.mq,
    "f": c.F,
    "g": c.G,
    "q0": c.q0,
    "qt": c.qt,
    "q0-left": c.q0Left,
    "qt-left": c.qtLeft
  };

  for (const [id, value] of Object.entries(data)) {
    $(id).textContent = fmt(value);
  }

  // 小数第1位表示
  for (const [id, value] of Object.entries({
    p: c.P,
    v: c.V,
    m: c.M
  })) {
    $(id).textContent = fmt1(value);
  }

  // マイナス時の色変更
  $("m-tile").classList.toggle(
    "negative",
    c.M !== null && c.M < 0
  );

  $("g-tile").classList.toggle(
    "negative",
    c.G !== null && c.G < 0
  );

  // 注意メッセージ
  $("notice").classList.toggle(
    "warn",
    c.M !== null && c.M <= 0
  );

  $("notice").textContent =
    c.M !== null && c.M <= 0
      ? "Mが0以下のため損益分岐点と目標達成Qを算出できません。"
      : "現在のP・V・Mが今後も継続する前提の計画値です。丸めにより実績Gとわずかな差が出る場合があります。";

  save();
}

// ======================================
// イベント設定・起動
// ======================================

load();

// 行追加
for (const [id, kind] of [
  ["add-buy", "buys"],
  ["add-sell", "sells"]
]) {
  $(id).addEventListener("click", () => {
    state[kind].push({
      id: nextId++,
      q: "",
      p: ""
    });

    renderRows();
    refresh();

    const inputs = $(
      kind === "buys" ? "buy-rows" : "sell-rows"
    ).querySelectorAll("input");

    inputs[inputs.length - 2]?.focus();
  });
}

// F・目標G
for (const [id, key] of [
  ["fixed", "fixed"],
  ["goal", "goal"]
]) {
  const el = $(id);
  el.value = state[key];

  el.addEventListener("input", () => {
    state[key] = el.value;

    el.classList.toggle(
      "invalid",
      (key === "fixed"
        ? number(el.value)
        : signedNumber(el.value)) === null
    );

    refresh();
  });
}

// 初期化
$("reset").addEventListener("click", () => {
  if (!confirm("入力内容を初期化しますか？")) {
    return;
  }

  state = initial();
  nextId = 3;

  $("fixed").value = state.fixed;
  $("goal").value = state.goal;

  renderRows();
  refresh();
});

// JSONバックアップ
$("export").addEventListener("click", () => {
  const backup = {
    version: "1.9",
    exportedAt: new Date().toISOString(),
    data: state
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "MG_Dashboard_backup.json";
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// 初回表示
renderRows();
refresh();
