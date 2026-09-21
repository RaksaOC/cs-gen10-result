const STATUS_LABEL = {
  passed: "Passed",
  "repeat-1": "Repeat 1",
  "repeat-2": "Repeat 2",
  "repeat-year": "Repeat year",
  failed: "Failed",
  dropped: "Dropped",
  suspend: "Suspend",
  "change-db": "Change to DB",
  other: "Other",
};

const TRACK_LABEL = {
  SE: "Software Engineering",
  DS: "Data Science",
  ALL: "SE & DS",
};

const state = {
  data: null,
  track: "SE",
  view: "students",
  filterTimer: null,
  choices: {},
};

const el = {
  splash: document.getElementById("splash"),
  app: document.getElementById("app"),
  sub: document.getElementById("page-sub"),
  kpis: document.getElementById("kpis"),
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  group: document.getElementById("filter-group"),
  grade: document.getElementById("filter-grade"),
  gpa: document.getElementById("filter-gpa"),
  status: document.getElementById("filter-status"),
  more: document.getElementById("filter-more"),
  subject: document.getElementById("filter-subject"),
  count: document.getElementById("count"),
  grid: document.getElementById("grid"),
  skeleton: document.getElementById("skeleton"),
  empty: document.getElementById("empty"),
  stage: document.getElementById("results-stage"),
  reset: document.getElementById("reset"),
  filterToggle: document.getElementById("filter-toggle"),
  filterDrawer: document.getElementById("filter-drawer"),
  sticky: document.getElementById("sticky-bar"),
  viewToggle: document.getElementById("view-toggle"),
  tooltip: document.getElementById("tooltip"),
};

function gradeClass(g) {
  if (g === "A") return "g-a";
  if (g === "B+") return "g-bp";
  if (g === "B") return "g-b";
  if (g === "C+") return "g-cp";
  if (g === "C") return "g-c";
  if (g === "F") return "g-f";
  return "";
}

function statusClass(status) {
  if (status === "passed") return "is-passed";
  if (["repeat-1", "repeat-2", "repeat-year"].includes(status)) return "is-repeat";
  if (["failed", "dropped", "suspend", "change-db"].includes(status)) return "is-fail";
  return "";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pinChoicesDropdown(choice) {
  const dropdown = choice.dropdown.element;
  const outer = choice.containerOuter.element;

  const place = () => {
    if (!outer.classList.contains("is-open")) return;
    if (dropdown.parentElement !== document.body) {
      document.body.appendChild(dropdown);
      dropdown.classList.add("choices-dropdown-portal");
    }
    const rect = outer.getBoundingClientRect();
    const preferred = Number(outer.closest(".field")?.dataset.menuMin || 280);
    const width = Math.min(
      Math.max(rect.width, preferred),
      window.innerWidth - 16
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    dropdown.style.position = "fixed";
    dropdown.style.left = `${Math.min(rect.left, window.innerWidth - width - 8)}px`;
    dropdown.style.width = `${width}px`;
    dropdown.style.minWidth = `${width}px`;
    dropdown.style.zIndex = "10000";
    dropdown.style.right = "auto";
    dropdown.style.maxHeight = "none";
    dropdown.style.overflow = "hidden";
    if (spaceBelow < 240 && rect.top > 240) {
      dropdown.style.top = "auto";
      dropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    } else {
      dropdown.style.bottom = "auto";
      dropdown.style.top = `${rect.bottom + 6}px`;
    }
  };

  const onScroll = () => place();
  choice.passedElement.element.addEventListener("showDropdown", () => {
    requestAnimationFrame(place);
  });
  choice.passedElement.element.addEventListener("hideDropdown", () => {
    dropdown.style.top = "";
    dropdown.style.bottom = "";
    dropdown.style.left = "";
    dropdown.style.width = "";
    dropdown.style.minWidth = "";
    dropdown.style.maxHeight = "";
    dropdown.style.overflow = "";
  });
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onScroll);
  choice._unpin = () => {
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll);
    if (dropdown.parentElement === document.body) dropdown.remove();
  };
}

function makeChoices(node, extra = {}) {
  const choice = new window.Choices(node, {
    searchEnabled: false,
    itemSelectText: "",
    shouldSort: false,
    allowHTML: false,
    position: "bottom",
    ...extra,
  });
  pinChoicesDropdown(choice);
  return choice;
}

function destroyChoice(id) {
  const existing = state.choices[id];
  if (!existing) return;
  if (typeof existing._unpin === "function") existing._unpin();
  existing.destroy();
  delete state.choices[id];
}

function initChoices() {
  const ids = [
    "sort",
    "filter-group",
    "filter-grade",
    "filter-gpa",
    "filter-status",
    "filter-more",
    "filter-subject",
  ];
  for (const id of ids) {
    const node = document.getElementById(id);
    if (!node || state.choices[id]) continue;
    state.choices[id] = makeChoices(node, {
      searchEnabled: id === "filter-subject",
      searchPlaceholderValue: "Find subject",
    });
  }
}

function setChoice(id, value) {
  const c = state.choices[id];
  if (c) c.setChoiceByValue(value);
  else document.getElementById(id).value = value;
}

function getChoice(id) {
  return document.getElementById(id).value;
}

function rebuildChoice(id, optionsHtml, preferred = "all") {
  const node = document.getElementById(id);
  destroyChoice(id);
  node.innerHTML = optionsHtml;
  state.choices[id] = makeChoices(node, {
    searchEnabled: id === "filter-subject",
    searchPlaceholderValue: "Find subject",
  });
  const values = [...node.options].map((o) => o.value);
  setChoice(id, values.includes(preferred) ? preferred : "all");
}

async function runSplash() {
  document.body.classList.add("splash-lock");
  await sleep(850);
  el.splash.classList.add("is-open");
  await sleep(1250);
  el.splash.classList.add("is-done");
  el.app.classList.remove("is-loading");
  el.app.classList.add("is-ready");
  document.body.classList.remove("splash-lock");
}

function showSkeleton(count = 6) {
  el.stage.classList.add("is-loading");
  el.skeleton.hidden = false;
  el.grid.innerHTML = "";
  el.empty.hidden = true;
  el.skeleton.innerHTML = Array.from({ length: count }, () => `
    <div class="sk">
      <div class="sk-line sm"></div>
      <div class="sk-line lg"></div>
      <div class="sk-line"></div>
      <div class="sk-block"></div>
      <div class="sk-line"></div>
      <div class="sk-line sm"></div>
    </div>
  `).join("");
}

function hideSkeleton() {
  el.stage.classList.remove("is-loading");
  el.skeleton.hidden = true;
  el.skeleton.innerHTML = "";
}

function pool() {
  const all = state.data.students;
  if (state.track === "ALL") return all;
  return all.filter((s) => s.track === state.track);
}

function matchGpa(gpa, filter) {
  const g = Number(gpa);
  if (filter === "all") return true;
  if (filter === "4.00") return g === 4;
  if (filter === "3.50") return g >= 3.5;
  if (filter === "3.00") return g >= 3;
  if (filter === "below3") return g < 3;
  if (filter === "0") return g === 0;
  return true;
}

function matchStatus(status, filter) {
  if (filter === "all") return true;
  if (filter === "repeat-any")
    return ["repeat-1", "repeat-2", "repeat-year"].includes(status);
  if (filter === "failed-any")
    return ["failed", "dropped", "suspend", "change-db"].includes(status);
  return status === filter;
}

function matchMore(s, filter) {
  if (filter === "all") return true;
  if (filter === "top10") return s.rank <= 10;
  if (filter === "top20") return s.rank <= 20;
  if (filter === "has-f") return s.fails > 0;
  if (filter === "no-f") return s.fails === 0;
  if (filter === "male") return s.gender === "M";
  if (filter === "female") return s.gender === "F";
  return true;
}

function filteredStudents() {
  const q = el.search.value.trim().toLowerCase();
  let list = pool().filter((s) => {
    const hay = `${s.name} ${s.id}`.toLowerCase();
    return (
      (!q || hay.includes(q)) &&
      (getChoice("filter-group") === "all" || s.group === getChoice("filter-group")) &&
      (getChoice("filter-grade") === "all" || s.grade === getChoice("filter-grade")) &&
      matchGpa(s.gpa, getChoice("filter-gpa")) &&
      matchStatus(s.status, getChoice("filter-status")) &&
      matchMore(s, getChoice("filter-more"))
    );
  });

  const mode = getChoice("sort");
  list = [...list].sort((a, b) => {
    if (mode === "rank-asc") {
      if (state.track === "ALL") return Number(b.overall) - Number(a.overall) || a.rank - b.rank;
      return a.rank - b.rank;
    }
    if (mode === "rank-desc") return b.rank - a.rank;
    if (mode === "overall-desc") return Number(b.overall) - Number(a.overall);
    if (mode === "overall-asc") return Number(a.overall) - Number(b.overall);
    if (mode === "gpa-desc") return Number(b.gpa) - Number(a.gpa) || a.rank - b.rank;
    if (mode === "gpa-asc") return Number(a.gpa) - Number(b.gpa) || a.rank - b.rank;
    if (mode === "name-asc") return a.name.localeCompare(b.name);
    return a.rank - b.rank;
  });
  return list;
}

/** Unique subject names for current track. For ALL, union of SE + DS (order: SE then DS-only). */
function subjectCatalog() {
  if (state.track === "SE") return [...state.data.tracks.SE.subjects];
  if (state.track === "DS") return [...state.data.tracks.DS.subjects];
  const se = state.data.tracks.SE.subjects;
  const ds = state.data.tracks.DS.subjects;
  const seen = new Set();
  const out = [];
  for (const name of [...se, ...ds]) {
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

function updateMeta(list) {
  el.sub.textContent = TRACK_LABEL[state.track];
  const base = pool();
  const passed = base.filter((x) => x.status === "passed").length;
  const repeat = base.filter((x) =>
    ["repeat-1", "repeat-2", "repeat-year"].includes(x.status)
  ).length;
  const avg =
    base.length > 0
      ? (base.reduce((n, x) => n + Number(x.gpa), 0) / base.length).toFixed(2)
      : "—";

  el.kpis.innerHTML = `
    <div class="kpi-pill">Students<strong>${base.length}</strong></div>
    <div class="kpi-pill">Passed<strong>${passed}</strong></div>
    <div class="kpi-pill">Repeat<strong>${repeat}</strong></div>
    <div class="kpi-pill">Avg GPA<strong>${avg}</strong></div>
  `;

  if (state.view === "students") {
    el.count.textContent = `Showing ${list.length} of ${base.length}`;
  }
}

function podiumPlace(s, list) {
  if (state.track !== "ALL") {
    if (s.rank === 1 || s.rank === 2 || s.rank === 3) return s.rank;
    return 0;
  }
  const top = [...list]
    .sort((a, b) => Number(b.overall) - Number(a.overall) || a.name.localeCompare(b.name))
    .slice(0, 3);
  const idx = top.findIndex((x) => x.id === s.id);
  return idx === -1 ? 0 : idx + 1;
}

function renderStudentCards(list) {
  if (!list.length) {
    el.grid.innerHTML = "";
    el.empty.hidden = false;
    return;
  }
  el.empty.hidden = true;
  el.grid.innerHTML = list
    .map((s, i) => {
      const place = podiumPlace(s, list);
      const podiumClass = place ? `podium podium-${place}` : "";
      const subjects = s.subjects
        .map(
          (sub) => `
          <li data-tip="${escapeHtml(sub.name)} · ${escapeHtml(sub.score)} ${escapeHtml(sub.grade)}">
            <span class="sub-name">${escapeHtml(sub.name)}</span>
            <span class="sub-meta">
              <span class="score">${escapeHtml(sub.score)}</span>
              <span class="badge ${gradeClass(sub.grade)}">${escapeHtml(sub.grade)}</span>
            </span>
          </li>`
        )
        .join("");
      return `
      <article class="card ${podiumClass}" style="animation-delay:${Math.min(i, 12) * 30}ms">
        <header class="card-head">
          <div>
            <p class="eyebrow">
              <span class="status-pill ${statusClass(s.status)}">${escapeHtml(STATUS_LABEL[s.status] || s.status)}</span>
              <span class="track-tag">${escapeHtml(s.track)}</span>
              ${escapeHtml(s.group)}
              · Rank #${s.rank}
              ${place ? `<span class="medal" data-tip="${place === 1 ? "Gold" : place === 2 ? "Silver" : "Bronze"}">#${place}</span>` : ""}
            </p>
            <h3>${escapeHtml(s.name)}</h3>
            <p class="id">${escapeHtml(s.id)}${s.gender ? ` · ${s.gender === "M" ? "Male" : "Female"}` : ""}</p>
          </div>
          <div class="stats">
            <div><span class="label">Overall</span><strong>${escapeHtml(s.overall)}</strong></div>
            <div><span class="label">Rank</span><strong>#${s.rank}</strong></div>
            <div><span class="label">GPA</span><strong>${escapeHtml(s.gpa)}</strong></div>
            <div><span class="label">Grade</span><strong class="badge ${gradeClass(s.grade)}">${escapeHtml(s.grade)}</strong></div>
          </div>
        </header>
        <ul class="subjects">${subjects}</ul>
        ${s.remark && s.remark.toUpperCase() !== "PASSED" ? `<p class="remark">${escapeHtml(s.remark)}</p>` : ""}
      </article>`;
    })
    .join("");
}

function renderSubjectBoards(list) {
  const subjects = subjectCatalog();
  const focus = getChoice("filter-subject");
  const boards = focus === "all" ? subjects : subjects.filter((n) => n === focus);

  const html = [];
  let boardCount = 0;

  for (let bi = 0; bi < boards.length; bi++) {
    const subjName = boards[bi];
    const rows = list
      .map((s) => {
        const hit = s.subjects.find((x) => x.name === subjName);
        if (!hit) return null;
        return { s, score: Number(hit.score), scoreStr: hit.score, grade: hit.grade };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name));

    if (!rows.length) continue;
    boardCount++;

    let lastScore = null;
    let lastRank = 0;
    const lis = rows
      .map((row, i) => {
        if (lastScore === null || row.score !== lastScore) {
          lastRank = i + 1;
          lastScore = row.score;
        }
        return `
        <li class="rank-row ${lastRank <= 3 ? `podium podium-${lastRank}` : ""}" style="animation-delay:${Math.min(i, 10) * 20}ms" data-tip="${escapeHtml(row.s.name)} · ${escapeHtml(row.scoreStr)}">
          <span class="rank-num">#${lastRank}</span>
          <span class="rank-main">
            <span class="rank-name">${escapeHtml(row.s.name)}</span>
            <span class="rank-id">${escapeHtml(row.s.id)} · ${escapeHtml(row.s.track)} ${escapeHtml(row.s.group)}</span>
          </span>
          <span class="score">${escapeHtml(row.scoreStr)}</span>
          <span class="badge ${gradeClass(row.grade)}">${escapeHtml(row.grade)}</span>
        </li>`;
      })
      .join("");

    const top = rows[0];
    html.push(`
      <article class="subject-board" style="animation-delay:${bi * 35}ms">
        <header>
          <p class="eyebrow">Subject ranking · ${rows.length} students</p>
          <h3>${escapeHtml(subjName)}</h3>
          <p class="subject-lead">#1 ${escapeHtml(top.s.name)} · ${escapeHtml(top.scoreStr)}</p>
        </header>
        <ol class="rank-list">${lis}</ol>
      </article>`);
  }

  if (!boardCount) {
    el.grid.innerHTML = "";
    el.empty.hidden = false;
    el.count.textContent = "Showing 0 subject boards";
    return;
  }

  el.empty.hidden = true;
  el.grid.innerHTML = html.join("");
  el.count.textContent = `Showing ${boardCount} subject board${boardCount === 1 ? "" : "s"}`;
}

async function render({ animate = true } = {}) {
  if (animate) {
    showSkeleton(6);
    await sleep(240);
  }

  const list = filteredStudents();
  updateMeta(list);
  hideSkeleton();

  if (state.view === "students") renderStudentCards(list);
  else renderSubjectBoards(list);
}

function scheduleRender() {
  clearTimeout(state.filterTimer);
  showSkeleton(6);
  state.filterTimer = setTimeout(() => render({ animate: true }), 200);
}

function fillGroupOptions() {
  const groups = [...new Set(pool().map((s) => s.group).filter((g) => g && g !== "—"))].sort();
  const preferred = getChoice("filter-group") || "all";
  const html =
    `<option value="all">All groups</option>` +
    groups.map((g) => `<option value="${g}">${g}</option>`).join("");
  rebuildChoice("filter-group", html, preferred);
}

function fillSubjectOptions() {
  const preferred = getChoice("filter-subject") || "all";
  const subjects = subjectCatalog();
  const html =
    `<option value="all">All subjects</option>` +
    subjects.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  rebuildChoice("filter-subject", html, preferred);
}

function setView(view) {
  state.view = view;
  el.viewToggle.dataset.active = view;
  el.viewToggle.querySelectorAll(".view-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  scheduleRender();
}

function wireTooltips() {
  const tip = el.tooltip;
  let active = null;

  function hide() {
    tip.hidden = true;
    active = null;
  }

  function show(target, text, event) {
    if (!text) return hide();
    active = target;
    tip.textContent = text;
    tip.hidden = false;
    const x = event.clientX;
    const y = event.clientY;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  document.addEventListener("pointerover", (e) => {
    const node = e.target.closest("[data-tip]");
    if (!node) return hide();
    show(node, node.getAttribute("data-tip"), e);
  });
  document.addEventListener("pointermove", (e) => {
    if (!active || tip.hidden) return;
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
  });
  document.addEventListener("pointerout", (e) => {
    if (active && e.relatedTarget && active.contains(e.relatedTarget)) return;
    if (!e.target.closest("[data-tip]")) hide();
  });
}

function wireSticky() {
  const io = new IntersectionObserver(
    ([entry]) => {
      el.sticky.classList.toggle("is-stuck", entry.intersectionRatio < 1);
    },
    { threshold: [1], rootMargin: "-1px 0px 0px 0px" }
  );
  io.observe(el.sticky);
}

function wire() {
  document.querySelectorAll(".track-tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".track-tabs .tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.track = btn.dataset.track;
      fillGroupOptions();
      fillSubjectOptions();
      scheduleRender();
    });
  });

  el.viewToggle.querySelectorAll(".view-tab").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  el.filterToggle.addEventListener("click", () => {
    const open = el.filterDrawer.hasAttribute("hidden");
    if (open) el.filterDrawer.removeAttribute("hidden");
    else el.filterDrawer.setAttribute("hidden", "");
    el.filterToggle.classList.toggle("is-on", open);
    el.filterToggle.setAttribute("aria-expanded", String(open));
  });

  el.search.addEventListener("input", scheduleRender);

  for (const id of ["sort", "filter-group", "filter-grade", "filter-gpa", "filter-status", "filter-more", "filter-subject"]) {
    document.getElementById(id).addEventListener("change", scheduleRender);
  }

  el.reset.addEventListener("click", () => {
    el.search.value = "";
    setChoice("sort", "rank-asc");
    setChoice("filter-group", "all");
    setChoice("filter-grade", "all");
    setChoice("filter-gpa", "all");
    setChoice("filter-status", "all");
    setChoice("filter-more", "all");
    setChoice("filter-subject", "all");
    scheduleRender();
  });

  wireTooltips();
  wireSticky();
}

async function boot() {
  initChoices();
  wire();
  el.viewToggle.dataset.active = "students";
  showSkeleton(6);

  const splashPromise = runSplash();
  const res = await fetch("data/results.json");
  state.data = await res.json();
  fillGroupOptions();
  fillSubjectOptions();

  await splashPromise;
  await render({ animate: true });
}

boot().catch((err) => {
  console.error(err);
  el.count.textContent = "Failed to load data.";
  hideSkeleton();
  el.empty.hidden = false;
  el.empty.textContent =
    "Could not load results.json. Serve this folder over HTTP (GitHub Pages or a local server).";
  el.app.classList.add("is-ready");
  el.splash.classList.add("is-open", "is-done");
  document.body.classList.remove("splash-lock");
});
