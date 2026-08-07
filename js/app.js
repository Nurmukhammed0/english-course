/* Course app: hash router + renderer, no build step, works from file:// */

const STORAGE_KEY = "course-progress-v1";
const EX_STORAGE_KEY = "exercise-progress-v2";
const THEME_KEY = "course-theme-v1";

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
let progress = loadProgress();

function isDone(id) { return !!progress[id]; }
function toggleDone(id) {
  progress[id] = !progress[id];
  saveProgress(progress);
}

function loadExProgress() {
  try { return JSON.parse(localStorage.getItem(EX_STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveExProgress(p) { localStorage.setItem(EX_STORAGE_KEY, JSON.stringify(p)); }
let exProgress = loadExProgress();

function exKey(lessonId, idx) { return `${lessonId}:${idx}`; }
function exState(lessonId, idx) { return exProgress[exKey(lessonId, idx)]; }
function setExState(lessonId, idx, patch) {
  exProgress[exKey(lessonId, idx)] = patch;
  saveExProgress(exProgress);
}
function exCompletedCount(l) {
  if (!l.exercises) return 0;
  return l.exercises.filter((_, i) => !!exState(l.id, i)).length;
}

/* ===================== Theme ===================== */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  applyTheme(theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
}

/** Percent-encode each path segment but keep "/" separators, so filenames
 *  with spaces / emoji / parentheses resolve correctly from file:// or http://. */
function mediaPath(folder, file) {
  return "" + encodeURIComponent(folder) + "/" + encodeURIComponent(file);
}

function lessonById(id) {
  return LESSONS.find((l) => String(l.id) === String(id));
}

function totalCompletable() {
  return LESSONS.length;
}
function completedCount() {
  return LESSONS.filter((l) => isDone(l.id)).length;
}

function updateNavProgress() {
  const done = completedCount();
  const total = totalCompletable();
  const pct = total ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById("navBar");
  const label = document.getElementById("navLabel");
  if (bar) bar.style.width = pct + "%";
  if (label) label.textContent = `${done}/${total}`;
}

/* ===================== Reveal-on-scroll ===================== */
let revealObserver;
function observeReveal(root = document) {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in-view");
            revealObserver.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
  }
  root.querySelectorAll(".lesson-card, .tl-item, [data-reveal]").forEach((el, i) => {
    el.style.transitionDelay = Math.min(i * 40, 320) + "ms";
    revealObserver.observe(el);
  });
}

/* ===================== Media renderers ===================== */
function renderMediaCard(folder, m) {
  const src = mediaPath(folder, m.file);
  if (m.type === "video") {
    return `<div class="media-card">
      <video src="${src}" controls preload="metadata"></video>
      <div class="cap">🎬 ${escapeHtml(m.caption || "")}</div>
    </div>`;
  }
  if (m.type === "audio") {
    return `<div class="media-card audio-card">
      <div class="cap">🎧 ${escapeHtml(m.caption || "")}</div>
      <audio src="${src}" controls preload="metadata"></audio>
    </div>`;
  }
  if (m.type === "image") {
    return `<div class="media-card">
      <img src="${src}" alt="${escapeHtml(m.caption || "")}" loading="lazy" onclick="openLightbox('${src.replace(/'/g, "\\'")}')" />
      <div class="cap">🖼️ ${escapeHtml(m.caption || "")}</div>
    </div>`;
  }
  return "";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function openLightbox(src) {
  const box = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImg");
  img.src = src;
  box.classList.add("open");
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
}

/* ===================== Vocab ===================== */
const VOCAB_PREVIEW_COUNT = 12;

function renderVocab(l) {
  if (!l.vocab || !l.vocab.length) return "";
  const cards = l.vocab.map((v, i) => {
    const extra = i >= VOCAB_PREVIEW_COUNT ? ' style="display:none" data-vocab-extra' : "";
    return `<div class="vocab-card"${extra}>
      <span class="en">${escapeHtml(v.en)}</span>
      <span class="tr">${escapeHtml(v.tr)}</span>
    </div>`;
  }).join("");
  const moreBtn = l.vocab.length > VOCAB_PREVIEW_COUNT
    ? `<button class="vocab-more-btn" onclick="toggleVocabMore(this)">Показать все слова (${l.vocab.length}) ↓</button>`
    : "";
  return `
  <div class="vocab-section" data-reveal>
    <div class="section-heading"><h2>📚 Новые слова</h2><span>${l.vocab.length}</span></div>
    <div class="vocab-grid">${cards}${moreBtn}</div>
  </div>`;
}

function toggleVocabMore(btn) {
  const grid = btn.closest(".vocab-grid");
  const hidden = grid.querySelectorAll("[data-vocab-extra]");
  const isHidden = hidden[0] && hidden[0].style.display === "none";
  hidden.forEach((el) => { el.style.display = isHidden ? "" : "none"; });
  btn.textContent = isHidden ? "Скрыть ↑" : `Показать все слова (${hidden.length + VOCAB_PREVIEW_COUNT}) ↓`;
}

/* ===================== Exercises ===================== */
function renderExercises(l) {
  if (!l.exercises || !l.exercises.length) return "";
  const total = l.exercises.length;
  const done = exCompletedCount(l);
  const cards = l.exercises.map((ex, i) => renderExerciseCard(l, ex, i)).join("");
  return `
  <div class="exercises-section" data-reveal>
    <div class="section-heading"><h2>✅ Задания</h2><span>${l.kind === "test" ? "тест" : "практика"}</span></div>
    <div class="exercises-progress">
      <span id="exProgressLabel-${l.id}">${done}/${total} выполнено</span>
      <div class="bar"><i id="exProgressBar-${l.id}" style="width:${total ? (done / total) * 100 : 0}%"></i></div>
    </div>
    ${cards}
  </div>`;
}

function renderExerciseCard(l, ex, idx) {
  const state = exState(l.id, idx);
  const cardId = `ex-${l.id}-${idx}`;
  let statusClass = "";
  if (state) statusClass = state.status === "incorrect" ? "incorrect" : "correct";
  const note = ex.note ? `<div class="ex-note">💡 ${escapeHtml(ex.note)}</div>` : "";

  let body = "";
  if (ex.type === "mcq") {
    body = `<div class="ex-options">${ex.options.map((opt, oi) => {
      let cls = "ex-option";
      let disabled = "";
      if (state) {
        disabled = "disabled";
        if (oi === ex.a) cls += " right";
        else if (oi === state.picked) cls += " wrong";
      }
      return `<button class="${cls}" ${disabled} onclick="answerMcq('${l.id}', ${idx}, ${oi})">${escapeHtml(opt)}</button>`;
    }).join("")}</div>`;
  } else if (ex.type === "tf") {
    const mk = (val, label) => {
      let cls = "ex-option";
      let disabled = "";
      if (state) {
        disabled = "disabled";
        if (val === ex.a) cls += " right";
        else if (val === state.picked) cls += " wrong";
      }
      return `<button class="${cls}" ${disabled} onclick="answerTf('${l.id}', ${idx}, ${val})">${label}</button>`;
    };
    body = `<div class="ex-tf-row">${mk(true, "✅ True")}${mk(false, "❌ False")}</div>`;
  } else if (ex.type === "fill") {
    const val = state ? escapeHtml(state.value || "") : "";
    const disabled = state ? "disabled" : "";
    body = `<div class="ex-fill-row">
      <input type="text" id="${cardId}-input" placeholder="Ваш ответ..." value="${val}" ${disabled} />
      <button class="btn sm ${state ? "secondary" : ""}" ${disabled} onclick="answerFill('${l.id}', ${idx})">Проверить</button>
    </div>`;
  } else if (ex.type === "write") {
    const val = state ? escapeHtml(state.value || "") : "";
    body = `<div class="ex-write">
      <textarea id="${cardId}-input" placeholder="Напишите свой ответ здесь...">${val}</textarea>
      <button class="btn sm secondary" onclick="answerWrite('${l.id}', ${idx})">${state ? "Обновить" : "Готово"}</button>
    </div>`;
  }

  let feedback = "";
  if (state) {
    if (state.status === "correct") feedback = `<div class="ex-feedback ok show">✅ Верно!</div>`;
    else if (state.status === "incorrect") feedback = `<div class="ex-feedback no show">❌ Правильный ответ: «${escapeHtml(exCorrectLabel(ex))}»</div>`;
    else feedback = `<div class="ex-feedback saved show">💾 Сохранено</div>`;
  }

  return `
  <div class="ex-card ${statusClass}" id="${cardId}">
    <span class="ex-num">Задание ${idx + 1}</span>
    <p class="ex-q">${escapeHtml(ex.q)}</p>
    ${body}
    ${feedback}
    ${note}
  </div>`;
}

function exCorrectLabel(ex) {
  if (ex.type === "mcq") return ex.options[ex.a];
  if (ex.type === "tf") return ex.a ? "True" : "False";
  if (ex.type === "fill") return ex.answers[0];
  return "";
}

function refreshExerciseCard(lessonId, idx) {
  const l = lessonById(lessonId);
  const ex = l.exercises[idx];
  const el = document.getElementById(`ex-${lessonId}-${idx}`);
  if (el) el.outerHTML = renderExerciseCard(l, ex, idx);
  const done = exCompletedCount(l);
  const total = l.exercises.length;
  const bar = document.getElementById(`exProgressBar-${lessonId}`);
  const label = document.getElementById(`exProgressLabel-${lessonId}`);
  if (bar) bar.style.width = (total ? (done / total) * 100 : 0) + "%";
  if (label) label.textContent = `${done}/${total} выполнено`;
}

function answerMcq(lessonId, idx, picked) {
  const l = lessonById(lessonId);
  const ex = l.exercises[idx];
  if (exState(lessonId, idx)) return;
  setExState(lessonId, idx, { status: picked === ex.a ? "correct" : "incorrect", picked });
  refreshExerciseCard(lessonId, idx);
}
function answerTf(lessonId, idx, picked) {
  const l = lessonById(lessonId);
  const ex = l.exercises[idx];
  if (exState(lessonId, idx)) return;
  setExState(lessonId, idx, { status: picked === ex.a ? "correct" : "incorrect", picked });
  refreshExerciseCard(lessonId, idx);
}
function answerFill(lessonId, idx) {
  const l = lessonById(lessonId);
  const ex = l.exercises[idx];
  const input = document.getElementById(`ex-${lessonId}-${idx}-input`);
  const value = (input.value || "").trim();
  const norm = value.toLowerCase().replace(/\s+/g, " ");
  const isRight = ex.answers.some((a) => a.toLowerCase().replace(/\s+/g, " ") === norm);
  setExState(lessonId, idx, { status: isRight ? "correct" : "incorrect", value });
  refreshExerciseCard(lessonId, idx);
}
function answerWrite(lessonId, idx) {
  const input = document.getElementById(`ex-${lessonId}-${idx}-input`);
  const value = (input.value || "").trim();
  if (!value) return;
  setExState(lessonId, idx, { status: "saved", value });
  refreshExerciseCard(lessonId, idx);
}

/* ===================== Views ===================== */
function renderHome() {
  const done = completedCount();
  const total = totalCompletable();
  const pct = total ? Math.round((done / total) * 100) : 0;
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (pct / 100) * circumference;

  const cards = LESSONS.map((l) => {
    const completed = isDone(l.id) ? "completed" : "";
    const testClass = l.kind === "test" ? "test-card" : "";
    const label = l.kind === "test" ? "Test" : `Урок ${l.number}`;
    return `
    <a class="lesson-card ${completed} ${testClass}" style="--hue:${l.hue}" href="#/lesson/${l.id}">
      <div class="top-row">
        <span class="badge">${label}</span>
        <span class="emoji">${l.emoji}</span>
      </div>
      <h3>${escapeHtml(l.title)}</h3>
      <p>${escapeHtml(l.subtitle)}</p>
      <div class="tags">${l.grammar.slice(0, 2).map((g) => `<span>${escapeHtml(g)}</span>`).join("")}</div>
      <div class="foot">
        <span class="open-link">Открыть <span class="arrow">→</span></span>
        <span class="done-check">${isDone(l.id) ? "✓" : ""}</span>
      </div>
    </a>`;
  }).join("");

  return `
  <section class="hero">
    <span class="eyebrow">${escapeHtml(COURSE.subtitle)}</span>
    <h1>${escapeHtml(COURSE.title)}</h1>
    <p class="lead">Все уроки, видео, аудио и материалы курса — в одном уютном месте. Отмечайте пройденное и возвращайтесь в любой момент.</p>
    <div class="progress-ring-wrap">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-2)" stroke-width="6"/>
        <circle cx="32" cy="32" r="26" fill="none" stroke="url(#gradRing)" stroke-width="6"
          stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
          transform="rotate(-90 32 32)" style="transition: stroke-dashoffset 0.8s var(--ease)"/>
        <defs>
          <linearGradient id="gradRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="var(--accent)"/>
            <stop offset="100%" stop-color="var(--accent-3)"/>
          </linearGradient>
        </defs>
      </svg>
      <div class="label"><b>${pct}% пройдено</b><span>${done} из ${total} уроков</span></div>
    </div>
  </section>
  <div class="section-heading">
    <h2>Все уроки</h2>
    <span>${total} модулей</span>
  </div>
  <div class="lesson-grid">${cards}</div>
  <div class="site-footer">Сделано с ❤️ — открывайте уроки офлайн, прогресс сохраняется в этом браузере</div>
  `;
}

function renderLesson(id) {
  const l = lessonById(id);
  if (!l) return `<div class="page"><p>Урок не найден. <a href="#/">На главную</a></p></div>`;

  const idx = LESSONS.findIndex((x) => x.id === l.id);
  const prev = LESSONS[idx - 1];
  const next = LESSONS[idx + 1];
  const done = isDone(l.id);

  const vocab = renderVocab(l);

  const sections = l.sections.map((s) => {
    const media = s.media && s.media.length
      ? `<div class="media-grid">${s.media.map((m) => renderMediaCard(l.folder, m)).join("")}</div>`
      : "";
    const links = s.links && s.links.length
      ? `<div class="tl-links">${s.links.map((lk) => `<a href="${lk.url}" target="_blank" rel="noopener">▶ ${escapeHtml(lk.label)}</a>`).join("")}</div>`
      : "";
    return `
    <div class="tl-item">
      <div class="tl-icon">${s.icon || "•"}</div>
      <div class="tl-body">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.text)}</p>
        ${links}
        ${media}
      </div>
    </div>`;
  }).join("");

  const exercises = renderExercises(l);
  const label = l.kind === "test" ? "Progress Test" : `Урок ${l.number}`;

  return `
  <div class="lesson-hero" style="--hue:${l.hue}">
    <div class="info">
      <div class="emoji-badge">${l.emoji}</div>
      <div>
        <h1>${escapeHtml(l.title)}</h1>
        <p class="sub">${escapeHtml(l.subtitle)}</p>
        <div class="badges">
          <span>${label}</span>
          ${l.grammar.map((g) => `<span>${escapeHtml(g)}</span>`).join("")}
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="btn secondary sm" onclick="location.hash='#/'">← Ко всем урокам</button>
      <button class="btn ${done ? "done" : ""}" id="doneBtn">
        <span class="chk">${done ? "✓" : "☐"}</span> ${done ? "Пройдено" : "Отметить пройденным"}
      </button>
    </div>
  </div>
  ${vocab}
  <div class="timeline">${sections}</div>
  ${exercises}
  <div class="lesson-footnav">
    ${prev ? `<a class="footnav-btn prev" href="#/lesson/${prev.id}"><small>← Назад</small><strong>${prev.emoji} ${escapeHtml(prev.title)}</strong></a>` : "<div></div>"}
    ${next ? `<a class="footnav-btn next" href="#/lesson/${next.id}"><small>Далее →</small><strong>${next.emoji} ${escapeHtml(next.title)}</strong></a>` : "<div></div>"}
  </div>
  `;
}

/* ===================== Vocabulary pool + favorites ===================== */
const FAV_KEY = "vocab-favorites-v1";
function loadFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY)) || {}; }
  catch { return {}; }
}
function saveFavorites(f) { localStorage.setItem(FAV_KEY, JSON.stringify(f)); }
let favorites = loadFavorites();
function isFavorite(key) { return !!favorites[key]; }
function toggleFavorite(key) {
  if (favorites[key]) delete favorites[key];
  else favorites[key] = true;
  saveFavorites(favorites);
}

/** Flat list of every vocab word across the course, tagged with its lesson. */
function allWords() {
  const out = [];
  LESSONS.forEach((l) => {
    (l.vocab || []).forEach((v, i) => {
      out.push({ en: v.en, tr: v.tr, hue: l.hue, lessonId: l.id, lessonTitle: l.title, key: `${l.id}:${i}` });
    });
  });
  return out;
}
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ===================== Vocabulary review page ===================== */
function renderVocabularyPage() {
  const groups = LESSONS.filter((l) => l.vocab && l.vocab.length);
  const totalWords = groups.reduce((sum, l) => sum + l.vocab.length, 0);
  const favCount = Object.keys(favorites).length;

  const groupsHtml = groups.map((l) => {
    const cards = l.vocab.map((v, i) => {
      const key = `${l.id}:${i}`;
      return `
      <div class="vr-card" style="--hue:${l.hue}" onclick="this.classList.toggle('revealed')" data-en="${escapeHtml(v.en.toLowerCase())}" data-tr="${escapeHtml(v.tr.toLowerCase())}">
        <button class="vr-star ${isFavorite(key) ? "on" : ""}" onclick="event.stopPropagation(); toggleFavoriteBtn(this, '${key}')" title="В избранное">★</button>
        <span class="vr-en">${escapeHtml(v.en)}</span>
        <span class="vr-tr">${escapeHtml(v.tr)}</span>
        <span class="vr-hint">тап 👆</span>
      </div>`;
    }).join("");
    return `
    <div class="vr-group" data-vr-group>
      <a class="vr-group-title" href="#/lesson/${l.id}" style="--hue:${l.hue}">
        <span class="vr-emoji">${l.emoji}</span>
        <span>${l.kind === "test" ? "" : `Урок ${l.number} — `}${escapeHtml(l.title)}</span>
        <span class="vr-count">${l.vocab.length}</span>
      </a>
      <button class="btn secondary sm vr-play-lesson" onclick="goToGame('lesson:${l.id}')">🎮 Играть с этим уроком</button>
      <div class="vr-grid">${cards}</div>
    </div>`;
  }).join("");

  return `
  <section class="hero" style="padding-bottom:26px">
    <span class="eyebrow">Повторение лексики</span>
    <h1>Все новые слова</h1>
    <p class="lead">${totalWords} слов из ${groups.length} уроков. Играйте в карточки — угадывайте слово, а незнакомые появятся снова, пока не выучите.</p>
    <div class="vr-play-row">
      <button class="btn" onclick="goToGame('all')">🎮 Играть — 20 случайных слов</button>
      <button class="btn secondary" onclick="goToGame('favorites')" ${favCount ? "" : "disabled"}>⭐ Играть с избранными (${favCount})</button>
    </div>
    <div class="vr-toolbar">
      <input type="text" id="vrSearch" class="vr-search" placeholder="🔍 Искать слово или перевод..." oninput="filterVocabPage(this.value)" />
      <button class="btn secondary sm" onclick="revealAllVocab(true)">Показать все переводы</button>
      <button class="btn secondary sm" onclick="revealAllVocab(false)">Скрыть все переводы</button>
    </div>
  </section>
  <div id="vrGroups">${groupsHtml}</div>
  <p class="vr-empty" id="vrEmpty" style="display:none">Ничего не найдено 🤷</p>
  <div class="site-footer">Сделано с ❤️ — открывайте уроки офлайн, прогресс сохраняется в этом браузере</div>
  `;
}

function toggleFavoriteBtn(btn, key) {
  toggleFavorite(key);
  btn.classList.toggle("on", isFavorite(key));
}

function filterVocabPage(query) {
  const q = query.trim().toLowerCase();
  let anyVisible = false;
  document.querySelectorAll("#vrGroups [data-vr-group]").forEach((group) => {
    let groupHasMatch = false;
    group.querySelectorAll(".vr-card").forEach((card) => {
      const match = !q || card.dataset.en.includes(q) || card.dataset.tr.includes(q);
      card.style.display = match ? "" : "none";
      if (match) groupHasMatch = true;
    });
    group.style.display = groupHasMatch ? "" : "none";
    if (groupHasMatch) anyVisible = true;
  });
  document.getElementById("vrEmpty").style.display = anyVisible ? "none" : "";
}

function revealAllVocab(show) {
  document.querySelectorAll(".vr-card").forEach((card) => {
    card.classList.toggle("revealed", show);
  });
}

/* ===================== Flashcard game ===================== */
const GAME_SIZE = 20;
let game = null;

function buildPool(scope) {
  const words = allWords();
  if (scope === "favorites") return words.filter((w) => isFavorite(w.key));
  if (scope.startsWith("lesson:")) {
    const id = scope.slice("lesson:".length);
    return words.filter((w) => String(w.lessonId) === id);
  }
  return words;
}

function initGame(scope) {
  const pool = shuffled(buildPool(scope));
  const size = Math.min(GAME_SIZE, pool.length);
  game = {
    scope,
    queue: pool.slice(0, size),
    total: size,
    wrongKeys: new Set(),
    answeredCount: 0,
    current: null,
    revealed: false,
    lastCorrect: null,
    finished: size === 0,
  };
  if (size > 0) game.current = game.queue.shift();
}

function goToGame(scope) {
  initGame(scope);
  if (location.hash === "#/game") paintGame();
  else location.hash = "#/game";
}

function playAgain() {
  initGame(game.scope);
  paintGame();
}

function exitGame() {
  game = null;
  location.hash = "#/vocabulary";
}

function gameAnswer(knew) {
  if (!game || !game.current || game.revealed) return;
  const key = game.current.key;
  if (!knew) {
    game.wrongKeys.add(key);
    game.queue.push(game.current);
  }
  game.revealed = true;
  game.lastCorrect = knew;
  paintGame();
}

function gameNext() {
  if (!game) return;
  game.answeredCount++;
  if (game.queue.length === 0) {
    game.finished = true;
    game.current = null;
  } else {
    game.current = game.queue.shift();
  }
  game.revealed = false;
  game.lastCorrect = null;
  paintGame();
}

function scopeLabel(scope) {
  if (scope === "all") return "случайные слова";
  if (scope === "favorites") return "избранные слова";
  if (scope.startsWith("lesson:")) {
    const l = lessonById(scope.slice("lesson:".length));
    return l ? `урок «${l.title}»` : "урок";
  }
  return "слова";
}

function renderGameScreen() {
  if (!game) return `<div class="game-empty"><p>Игра не найдена.</p><button class="btn" onclick="location.hash='#/vocabulary'">← К словам</button></div>`;

  if (game.total === 0) {
    return `
    <div class="game-wrap">
      <div class="game-empty">
        <p>😅 В этой подборке пока нет слов (например, вы ещё не добавили избранные).</p>
        <button class="btn" onclick="location.hash='#/vocabulary'">← К словам</button>
      </div>
    </div>`;
  }

  if (game.finished) {
    const perfect = game.total - game.wrongKeys.size;
    return `
    <div class="game-wrap">
      <div class="game-end" data-reveal>
        <div class="game-end-emoji">🎉</div>
        <h2>Готово! ${game.total} слов пройдено</h2>
        <p class="game-end-stats">✅ С первого раза: <b>${perfect}</b> &nbsp;·&nbsp; 🔁 Пришлось повторить: <b>${game.wrongKeys.size}</b></p>
        <div class="game-end-actions">
          <button class="btn" onclick="playAgain()">🔁 Играть ещё раз</button>
          <button class="btn secondary" onclick="exitGame()">← К словам</button>
        </div>
      </div>
    </div>`;
  }

  const w = game.current;
  const progressPct = Math.round((game.answeredCount / game.total) * 100);
  const remaining = game.queue.length + 1;

  const answerButtons = !game.revealed
    ? `<div class="game-choice-row">
        <button class="btn secondary game-choice" onclick="gameAnswer(false)">❓ Не знаю</button>
        <button class="btn game-choice" onclick="gameAnswer(true)">✅ Знаю</button>
      </div>`
    : `<div class="game-next-row">
        <button class="btn" onclick="gameNext()">Далее →</button>
      </div>`;

  return `
  <div class="game-wrap">
    <div class="game-top">
      <button class="btn ghost sm" onclick="exitGame()">✕ Выйти</button>
      <div class="game-progress">
        <span>${game.answeredCount}/${game.total} · осталось ${remaining}</span>
        <div class="bar"><i style="width:${progressPct}%"></i></div>
      </div>
      <span class="game-scope-label">${scopeLabel(game.scope)}</span>
    </div>
    <div class="game-card ${game.revealed ? (game.lastCorrect ? "know" : "dontknow") : ""}" style="--hue:${w.hue}">
      <button class="vr-star game-star ${isFavorite(w.key) ? "on" : ""}" onclick="toggleFavoriteBtn(this, '${w.key}')" title="В избранное">★</button>
      <span class="game-lesson-tag">${escapeHtml(w.lessonTitle)}</span>
      <div class="game-en">${escapeHtml(w.en)}</div>
      <div class="game-tr ${game.revealed ? "show" : ""}">${escapeHtml(w.tr)}</div>
    </div>
    ${answerButtons}
  </div>`;
}

function paintGame() {
  const view = document.getElementById("view");
  view.innerHTML = `<div class="page">${renderGameScreen()}</div>`;
  requestAnimationFrame(() => observeReveal(view));
}

/* ===================== Router ===================== */
function render() {
  const view = document.getElementById("view");
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/lesson\/(.+)$/);

  if (hash === "#/vocabulary") {
    view.innerHTML = `<div class="page">${renderVocabularyPage()}</div>`;
  } else if (hash === "#/game") {
    if (!game) initGame("all");
    view.innerHTML = `<div class="page">${renderGameScreen()}</div>`;
  } else if (m) {
    view.innerHTML = `<div class="page">${renderLesson(m[1])}</div>`;
    const btn = document.getElementById("doneBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        toggleDone(m[1]);
        render();
        updateNavProgress();
      });
    }
  } else {
    view.innerHTML = `<div class="page">${renderHome()}</div>`;
  }

  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  updateNavProgress();
  requestAnimationFrame(() => observeReveal(view));
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  render();
  const lb = document.getElementById("lightbox");
  lb.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);
});
