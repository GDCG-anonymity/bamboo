import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, connectFirestoreEmulator, collection, doc, query, where, orderBy, limit,
  startAfter, getDocs, getDoc, runTransaction, writeBatch, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js";

/* ───────────── Firebase ───────────── */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
if (location.hostname === "localhost" && new URLSearchParams(location.search).has("emu")) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
}

const PAGE = 20;
const POST_MAX = 2000;
const COMMENT_MAX = 500;
const REPORT_LIMIT = 3;

/* ───────────── 테마 ───────────── */
const pad = (n, w = 4) => String(n).padStart(w, "0");
const THEMES = {
  dark: {
    short: "어둠탐사기록",
    org: "어둠탐사기록",
    logo: "logos/dark-invert.png",
    icon: "logos/dark-icon.png",
    title: "어둠탐사기록에서 전해드립니다",
    tagline: "당신이 겪은 이야기를 익명으로 남겨주세요.",
    postNo: (no) => `탐사기록 #${pad(no)}`,
    commenter: (n) => `이름${n}`,
    author: "작성자",
    report: "이용자 신고",
    write: "기록하기",
    composeTitle: "새 탐사기록",
    placeholder: "무엇을 보셨나요?",
    submit: "기록 남기기",
    comments: "댓글",
    commentPh: "댓글을 남겨주세요",
    hidden: "신고가 누적되어 가려진 기록입니다.",
    deleted: "작성자가 삭제한 기록입니다.",
    cDeleted: "삭제된 댓글입니다.",
    empty: "아직 남겨진 기록이 없습니다.",
    foot: "모든 기록은 익명으로 남겨집니다.",
  },
  daydream: {
    short: "백일몽",
    org: "Daydream Inc.",
    logo: "logos/daydream.png",
    icon: "logos/daydream-icon.png",
    title: "백일몽에서 전해드립니다",
    tagline: "백일몽 주식회사 사내 익명 게시판",
    postNo: (no) => `익명 게시글 No.${no}`,
    commenter: (n) => `익명 사원${n}`,
    author: "작성 사원",
    report: "보안팀 신고",
    write: "글쓰기",
    composeTitle: "익명 게시글 작성",
    placeholder: "동료들에게 하고 싶은 이야기를 남겨주세요.",
    submit: "게시",
    comments: "댓글",
    commentPh: "댓글을 입력하세요",
    hidden: "보안팀 검토 중인 게시글입니다.",
    deleted: "작성 사원이 삭제한 게시글입니다.",
    cDeleted: "삭제된 댓글입니다.",
    empty: "아직 게시글이 없습니다.",
    foot: "작성자 정보는 누구에게도 공개되지 않습니다.",
  },
  bureau: {
    short: "재난관리국",
    org: "초자연 재난관리국",
    logo: "logos/bureau.png",
    icon: "logos/bureau-icon.png",
    title: "재난관리국에서 전해드립니다",
    tagline: "초자연 재난 익명 제보 접수처",
    postNo: (no, d) => `접수번호 제${(d || new Date()).getFullYear()}-${pad(no)}호`,
    commenter: (n) => `요원${n}`,
    author: "작성 요원",
    report: "긴급 신고",
    write: "제보 접수",
    composeTitle: "익명 제보서",
    placeholder: "목격한 이상 현상을 기재하십시오.",
    submit: "접수",
    comments: "회신",
    commentPh: "회신을 기재하십시오",
    hidden: "긴급 신고 누적으로 열람이 제한된 제보입니다.",
    deleted: "작성 요원이 철회한 제보입니다.",
    cDeleted: "철회된 회신입니다.",
    empty: "접수된 제보가 없습니다.",
    foot: "제보자의 신원은 관계 법령에 따라 보호됩니다.",
  },
};
const THEME_ORDER = ["dark", "daydream", "bureau"];
let themeKey = "dark";
try {
  const saved = localStorage.getItem("jd-theme");
  if (saved && THEMES[saved]) themeKey = saved;
} catch (e) { /* 저장소 사용 불가 → 기본 테마 */ }
const T = () => THEMES[themeKey];

/* ───────────── 유틸 ───────────── */
const $ = (s, el = document) => el.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
  return el;
}
async function sha(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function toDate(ts) { return ts && ts.toDate ? ts.toDate() : new Date(); }
function rel(ts) {
  const d = toDate(ts), s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  const y = d.getFullYear() === new Date().getFullYear() ? "" : `${d.getFullYear()}.`;
  return `${y}${d.getMonth() + 1}.${d.getDate()}`;
}
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}
function errMsg(e) {
  console.error(e);
  if (e && e.message && e.message.startsWith("!")) return e.message.slice(1);
  if (e && e.code === "permission-denied") return "너무 빠르게 작성했거나 권한이 없어요. 잠시 후 다시 시도해주세요.";
  if (e && e.code === "unavailable") return "연결이 불안정해요. 잠시 후 다시 시도해주세요.";
  return "문제가 생겼어요. 잠시 후 다시 시도해주세요.";
}

/* ───────────── 시트/대화상자 ───────────── */
function openSheet(content, { onClose } = {}) {
  const ov = $("#overlay");
  ov.innerHTML = "";
  const box = h("div", { class: "sheet", role: "dialog", "aria-modal": "true" }, content);
  ov.append(box);
  ov.hidden = false;
  document.body.classList.add("locked");
  const close = () => {
    ov.hidden = true; ov.innerHTML = "";
    document.body.classList.remove("locked");
    ov.onclick = null;
    onClose && onClose();
  };
  ov.onclick = (e) => { if (e.target === ov) close(); };
  return close;
}
function menu(items) {
  return new Promise((resolve) => {
    let picked = null;
    const close = openSheet(
      h("div", { class: "menu" },
        items.map((it) => h("button", {
          type: "button", class: `menu-item${it.danger ? " danger" : ""}`,
          onclick: () => { picked = it.key; close(); },
        }, it.label)),
        h("button", { type: "button", class: "menu-item cancel", onclick: () => close() }, "닫기")),
      { onClose: () => resolve(picked) });
  });
}
function confirmBox(msg, okLabel = "확인", danger = false) {
  return new Promise((resolve) => {
    let ok = false;
    const close = openSheet(
      h("div", { class: "dialog" },
        h("p", { class: "dialog-msg" }, msg),
        h("div", { class: "row-end" },
          h("button", { type: "button", class: "btn ghost", onclick: () => close() }, "취소"),
          h("button", { type: "button", class: `btn ${danger ? "danger" : "primary"}`, onclick: () => { ok = true; close(); } }, okLabel))),
      { onClose: () => resolve(ok) });
  });
}
function promptBox(msg, { type = "text", okLabel = "확인", placeholder = "", value = "" } = {}) {
  return new Promise((resolve) => {
    let val = null;
    const input = h("input", { class: "input", type, placeholder, autocomplete: "off" });
    input.value = value;
    const form = h("form", { class: "dialog", onsubmit: (e) => { e.preventDefault(); val = input.value; close(); } },
      h("p", { class: "dialog-msg" }, msg), input,
      h("div", { class: "row-end" },
        h("button", { type: "button", class: "btn ghost", onclick: () => close() }, "취소"),
        h("button", { type: "submit", class: "btn primary" }, okLabel)));
    const close = openSheet(form, { onClose: () => resolve(val) });
    setTimeout(() => input.focus(), 50);
  });
}

/* ───────────── 상태 ───────────── */
let me = null;
let isAdmin = false;
const keyCache = new Map();
async function myKey(postId) {
  const k = `${me.uid}:${postId}`;
  if (!keyCache.has(k)) keyCache.set(k, await sha(k));
  return keyCache.get(k);
}
const feed = { posts: [], last: null, done: false, loading: false, loaded: false, mode: "open" };
let detail = null; // { id, post, comments }

/* ───────────── 테마 적용 ───────────── */
function applyTheme() {
  const t = T();
  document.documentElement.dataset.theme = themeKey;
  document.title = t.title;
  $("#siteTitle").textContent = t.title;
  $("#tagline").textContent = t.tagline;
  $("#brandOrg").textContent = t.org;
  $("#brandLogo").src = t.logo;
  $("#favicon").href = t.icon;
  $("#footNote").textContent = t.foot;
  $("#writeBtn").textContent = t.write;
  const sw = $("#themeSwitch");
  sw.innerHTML = "";
  for (const k of THEME_ORDER) {
    sw.append(h("button", {
      type: "button", class: `chip${k === themeKey ? " on" : ""}`, "aria-pressed": String(k === themeKey),
      onclick: () => setTheme(k),
    }, THEMES[k].short));
  }
}
function setTheme(k) {
  themeKey = k;
  try { localStorage.setItem("jd-theme", k); } catch (e) { /* 무시 */ }
  applyTheme();
  render();
}

/* ───────────── 라우팅 ───────────── */
function currentRoute() {
  const m = location.hash.match(/^#\/p\/([\w-]+)/);
  if (m) return { name: "post", id: m[1] };
  if (location.hash.startsWith("#/hidden")) return { name: "hidden" };
  return { name: "feed" };
}
async function route() {
  const r = currentRoute();
  $("#writeBtn").hidden = r.name !== "feed";
  if (r.name === "post") {
    if (!detail || detail.id !== r.id) await loadDetail(r.id);
  } else {
    const mode = r.name === "hidden" && isAdmin ? "hidden" : "open";
    if (!feed.loaded || feed.mode !== mode) await loadFeed(true, mode);
  }
  render();
  if (r.name === "post") window.scrollTo(0, 0);
}
function render() {
  const r = currentRoute();
  const view = $("#view");
  view.innerHTML = "";
  if (r.name === "post") view.append(renderDetail());
  else view.append(renderFeed());
}

/* ───────────── 데이터: 목록 ───────────── */
async function loadFeed(reset, mode = feed.mode) {
  if (feed.loading) return;
  if (reset) Object.assign(feed, { posts: [], last: null, done: false, mode });
  if (feed.done) return;
  feed.loading = true;
  try {
    const parts = [collection(db, "posts"), where("hidden", "==", mode === "hidden"), orderBy("createdAt", "desc")];
    if (feed.last) parts.push(startAfter(feed.last));
    parts.push(limit(PAGE));
    const snap = await getDocs(query(...parts));
    snap.forEach((d) => feed.posts.push({ id: d.id, ...d.data() }));
    feed.last = snap.docs[snap.docs.length - 1] || feed.last;
    if (snap.size < PAGE) feed.done = true;
    feed.loaded = true;
  } catch (e) {
    toast(errMsg(e));
  } finally {
    feed.loading = false;
  }
}

/* ───────────── 데이터: 상세 ───────────── */
async function loadDetail(id) {
  detail = { id, post: null, comments: [], state: "loading" };
  render();
  try {
    const snap = await getDoc(doc(db, "posts", id));
    if (!snap.exists()) { detail.state = "missing"; return; }
    detail.post = { id, ...snap.data() };
    await loadComments();
    detail.state = "ok";
  } catch (e) {
    detail.state = e.code === "permission-denied" ? "hidden" : "error";
    if (detail.state === "error") toast(errMsg(e));
  }
}
async function loadComments() {
  const col = collection(db, "posts", detail.id, "comments");
  const q = isAdmin ? query(col, orderBy("createdAt", "asc"))
    : query(col, where("hidden", "==", false), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  detail.comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ───────────── 화면: 글 카드 ───────────── */
function postCard(p, { inDetail = false } = {}) {
  const t = T();
  const d = toDate(p.createdAt);
  const card = h("article", { class: `post${p.deleted ? " is-deleted" : ""}${p.hidden ? " is-hidden" : ""}` },
    h("header", { class: "post-head" },
      h("span", { class: "post-no" }, t.postNo(p.no, d)),
      h("time", { class: "post-time", datetime: d.toISOString() }, rel(p.createdAt)),
      p.deleted && !isAdmin ? null : h("button", {
        type: "button", class: "more", "aria-label": "더보기",
        onclick: (e) => { e.stopPropagation(); postMenu(p); },
      }, "⋯")),
    p.deleted
      ? h("p", { class: "post-body muted" }, t.deleted)
      : h("div", { class: "post-body" }, p.body),
    isAdmin && p.hidden ? h("p", { class: "admin-note" }, `가려진 글 · 신고 ${p.reportCount}회`) : null,
    inDetail ? null : h("footer", { class: "post-foot" },
      h("a", { class: "cmt-link", href: `#/p/${p.id}` }, `${t.comments} ${p.commentCount || 0}`)));
  if (!inDetail) {
    card.classList.add("clickable");
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, a")) return;
      if (window.getSelection && String(window.getSelection()).length) return;
      location.hash = `#/p/${p.id}`;
    });
  }
  return card;
}

function renderFeed() {
  const t = T();
  const frag = h("div", { class: "feed" });
  if (feed.mode === "hidden") {
    frag.append(h("div", { class: "admin-bar" },
      h("strong", {}, "가려진 글 목록"), h("a", { href: "#/" }, "← 전체 글로")));
  }
  if (!feed.loaded && feed.loading) frag.append(h("p", { class: "empty" }, "불러오는 중…"));
  const shown = feed.posts.filter((p) => isAdmin || !p.deleted || p.commentCount > 0);
  if (feed.loaded && shown.length === 0) {
    frag.append(h("p", { class: "empty" }, feed.mode === "hidden" ? "가려진 글이 없어요." : t.empty));
  }
  shown.forEach((p) => frag.append(postCard(p)));
  if (feed.loaded && !feed.done) {
    const more = h("button", {
      type: "button", class: "btn ghost wide",
      onclick: async () => { more.disabled = true; more.textContent = "불러오는 중…"; await loadFeed(false); render(); },
    }, "더 보기");
    frag.append(more);
  }
  return frag;
}

/* ───────────── 화면: 상세 ───────────── */
function renderDetail() {
  const t = T();
  const wrap = h("div", { class: "detail" },
    h("a", { class: "back", href: "#/" }, "← 목록"));
  if (!detail || detail.state === "loading") { wrap.append(h("p", { class: "empty" }, "불러오는 중…")); return wrap; }
  if (detail.state === "missing") { wrap.append(h("p", { class: "empty" }, "존재하지 않는 글이에요.")); return wrap; }
  if (detail.state === "hidden") { wrap.append(h("p", { class: "empty" }, t.hidden)); return wrap; }
  if (detail.state === "error") { wrap.append(h("p", { class: "empty" }, "글을 불러오지 못했어요.")); return wrap; }

  const p = detail.post;
  wrap.append(postCard(p, { inDetail: true }));
  wrap.append(h("div", { class: "share-row" },
    h("button", { type: "button", class: "btn ghost small", onclick: () => copyLink(p.id) }, "링크 복사")));

  const list = h("section", { class: "comments", "aria-label": t.comments },
    h("h2", { class: "comments-title" }, `${t.comments} ${p.commentCount || 0}`));
  if (detail.comments.length === 0) list.append(h("p", { class: "empty small" }, "아직 없어요."));
  detail.comments.forEach((c) => list.append(commentItem(c)));
  wrap.append(list);

  if (!p.deleted) wrap.append(commentForm());
  return wrap;
}
function commentItem(c) {
  const t = T();
  const isAuthor = c.n === 0;
  return h("div", { class: `comment${isAuthor ? " by-author" : ""}${c.hidden ? " is-hidden" : ""}` },
    h("div", { class: "c-head" },
      h("span", { class: "c-name" }, isAuthor ? t.author : t.commenter(c.n)),
      h("time", { class: "c-time" }, rel(c.createdAt)),
      c.deleted && !isAdmin ? null : h("button", {
        type: "button", class: "more", "aria-label": "더보기", onclick: () => commentMenu(c),
      }, "⋯")),
    c.deleted ? h("p", { class: "c-body muted" }, t.cDeleted) : h("p", { class: "c-body" }, c.body),
    isAdmin && c.hidden ? h("p", { class: "admin-note" }, `가려진 댓글 · 신고 ${c.reportCount}회`) : null);
}
function commentForm() {
  const t = T();
  const ta = h("textarea", { class: "input", rows: "1", maxlength: String(COMMENT_MAX), placeholder: t.commentPh, "aria-label": t.commentPh });
  const btn = h("button", { type: "submit", class: "btn primary" }, "등록");
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; });
  const form = h("form", {
    class: "comment-form",
    onsubmit: async (e) => {
      e.preventDefault();
      const body = ta.value.trim();
      if (!body) return;
      btn.disabled = true;
      try {
        await addComment(detail.id, body);
        ta.value = "";
        await refreshDetail();
      } catch (err) { toast(errMsg(err)); }
      finally { btn.disabled = false; }
    },
  }, ta, btn);
  return form;
}
async function refreshDetail() {
  const snap = await getDoc(doc(db, "posts", detail.id));
  if (snap.exists()) detail.post = { id: detail.id, ...snap.data() };
  await loadComments();
  const fp = feed.posts.find((x) => x.id === detail.id);
  if (fp) Object.assign(fp, detail.post);
  render();
}
async function copyLink(id) {
  const url = `${location.origin}${location.pathname}#/p/${id}`;
  try { await navigator.clipboard.writeText(url); toast("링크를 복사했어요."); }
  catch (e) { await promptBox("아래 링크를 길게 눌러 복사하세요.", { okLabel: "닫기", value: url }); }
}

/* ───────────── 글쓰기 ───────────── */
function openCompose() {
  const t = T();
  const ta = h("textarea", { class: "input compose-ta", maxlength: String(POST_MAX), placeholder: t.placeholder, "aria-label": t.placeholder });
  const count = h("span", { class: "count" }, `0 / ${POST_MAX}`);
  const pw = h("input", { class: "input", type: "password", placeholder: "삭제 비밀번호 (선택)", autocomplete: "new-password", maxlength: "40" });
  const btn = h("button", { type: "submit", class: "btn primary" }, t.submit);
  ta.addEventListener("input", () => (count.textContent = `${ta.value.length} / ${POST_MAX}`));
  const form = h("form", {
    class: "compose",
    onsubmit: async (e) => {
      e.preventDefault();
      const body = ta.value.trim();
      if (!body) { toast("내용을 입력해주세요."); return; }
      btn.disabled = true;
      try {
        const id = await createPost(body, pw.value);
        close();
        toast("등록되었어요.");
        await loadFeed(true, "open");
        location.hash = "#/";
        render();
        void id;
      } catch (err) { toast(errMsg(err)); btn.disabled = false; }
    },
  },
  h("div", { class: "compose-head" }, h("strong", {}, t.composeTitle), count),
  ta,
  pw,
  h("p", { class: "hint" }, "비밀번호를 정해두면 다른 기기나 앱에서도 이 글을 삭제할 수 있어요. 정하지 않으면 지금 쓰는 브라우저에서만 삭제할 수 있어요."),
  h("div", { class: "row-end" },
    h("button", { type: "button", class: "btn ghost", onclick: () => close() }, "취소"), btn));
  const close = openSheet(form);
  setTimeout(() => ta.focus(), 50);
}

async function createPost(body, password) {
  const postRef = doc(collection(db, "posts"));
  const ak = await myKey(postRef.id);
  const secretH = password ? await sha(await sha(`${password}:${postRef.id}`)) : null;
  const counterRef = doc(db, "meta", "counter");
  const limRef = doc(db, "limits", me.uid);
  await runTransaction(db, async (tx) => {
    const c = await tx.get(counterRef);
    const no = c.exists() ? c.data().last + 1 : 1;
    tx.set(counterRef, { last: no });
    tx.set(postRef, {
      no, body, createdAt: serverTimestamp(), ak,
      hidden: false, deleted: false, reportCount: 0, commentCount: 0, memberCount: 0,
      hasPw: !!secretH,
    });
    if (secretH) tx.set(doc(postRef, "secret", "del"), { h: secretH });
    tx.set(limRef, { lastPost: serverTimestamp() }, { merge: true });
  });
  return postRef.id;
}

async function addComment(postId, body) {
  const postRef = doc(db, "posts", postId);
  const ck = await myKey(postId);
  const memRef = doc(postRef, "members", ck);
  const cRef = doc(collection(postRef, "comments"));
  const limRef = doc(db, "limits", me.uid);
  await runTransaction(db, async (tx) => {
    const p = await tx.get(postRef);
    if (!p.exists() || p.data().deleted) throw new Error("!삭제된 글에는 댓글을 달 수 없어요.");
    const pd = p.data();
    const upd = { commentCount: pd.commentCount + 1 };
    let n;
    if (ck === pd.ak) n = 0;
    else {
      const m = await tx.get(memRef);
      if (m.exists()) n = m.data().n;
      else {
        n = pd.memberCount + 1;
        upd.memberCount = n;
        tx.set(memRef, { n });
      }
    }
    tx.update(postRef, upd);
    tx.set(cRef, { body, createdAt: serverTimestamp(), ck, n, hidden: false, deleted: false, reportCount: 0 });
    tx.set(limRef, { lastComment: serverTimestamp() }, { merge: true });
  });
}

/* ───────────── 글 메뉴 ───────────── */
async function postMenu(p) {
  const t = T();
  const mine = !p.deleted && (await myKey(p.id)) === p.ak;
  const items = [{ key: "link", label: "링크 복사" }];
  if (!p.deleted && !mine) items.push({ key: "report", label: t.report, danger: true });
  if (!p.deleted) items.push({ key: "delete", label: isAdmin && !mine ? "[관리] 삭제" : "삭제", danger: isAdmin });
  if (isAdmin) {
    if (p.hidden) items.push({ key: "unhide", label: "[관리] 가림 해제" });
    else items.push({ key: "hide", label: "[관리] 가리기" });
  }
  const k = await menu(items);
  try {
    if (k === "link") await copyLink(p.id);
    else if (k === "report") await reportPost(p);
    else if (k === "delete") await deletePost(p, mine);
    else if (k === "unhide") { await updateDoc(doc(db, "posts", p.id), { hidden: false, reportCount: 0 }); toast("가림을 해제했어요."); await afterChange(p.id); }
    else if (k === "hide") { await updateDoc(doc(db, "posts", p.id), { hidden: true }); toast("글을 가렸어요."); await afterChange(p.id); }
  } catch (e) { toast(errMsg(e)); }
}
async function afterChange(postId) {
  await loadFeed(true, feed.mode);
  if (detail && detail.id === postId) await loadDetail(postId);
  render();
}
async function reportPost(p) {
  const t = T();
  if (!(await confirmBox(`이 글을 ${t.report}할까요?\n신고가 ${REPORT_LIMIT}건 쌓이면 자동으로 가려져요.`, "신고", true))) return;
  const postRef = doc(db, "posts", p.id);
  const repRef = doc(postRef, "reports", await myKey(p.id));
  await runTransaction(db, async (tx) => {
    const r = await tx.get(repRef);
    if (r.exists()) throw new Error("!이미 신고한 글이에요.");
    const s = await tx.get(postRef);
    const cnt = s.data().reportCount + 1;
    tx.update(postRef, { reportCount: cnt, hidden: s.data().hidden || cnt >= REPORT_LIMIT });
    tx.set(repRef, { at: serverTimestamp() });
  });
  toast("신고가 접수되었어요.");
  await afterChange(p.id);
}
async function deletePost(p, mine) {
  const postRef = doc(db, "posts", p.id);
  if (mine || isAdmin) {
    if (!(await confirmBox("이 글을 삭제할까요?", "삭제", true))) return;
    await updateDoc(postRef, { deleted: true, body: "" });
  } else if (p.hasPw) {
    const pw = await promptBox("글을 쓸 때 정한 삭제 비밀번호를 입력하세요.", { type: "password", okLabel: "삭제" });
    if (!pw) return;
    const attempt = await sha(`${pw}:${p.id}`);
    const b = writeBatch(db);
    b.update(doc(postRef, "secret", "del"), { attempt });
    b.update(postRef, { deleted: true, body: "" });
    try { await b.commit(); }
    catch (e) { if (e.code === "permission-denied") throw new Error("!비밀번호가 맞지 않아요."); throw e; }
  } else {
    await confirmBox("비밀번호 없이 쓴 글은 작성한 브라우저에서만 삭제할 수 있어요.", "확인");
    return;
  }
  toast("삭제했어요.");
  await afterChange(p.id);
}

/* ───────────── 댓글 메뉴 ───────────── */
async function commentMenu(c) {
  const t = T();
  const mine = !c.deleted && (await myKey(detail.id)) === c.ck;
  const items = [];
  if (!c.deleted && !mine) items.push({ key: "report", label: t.report, danger: true });
  if (!c.deleted && (mine || isAdmin)) items.push({ key: "delete", label: isAdmin && !mine ? "[관리] 삭제" : "삭제", danger: true });
  if (isAdmin) items.push(c.hidden ? { key: "unhide", label: "[관리] 가림 해제" } : { key: "hide", label: "[관리] 가리기" });
  if (!items.length) { toast("이 댓글은 작성한 브라우저에서만 삭제할 수 있어요."); return; }
  const k = await menu(items);
  const cRef = doc(db, "posts", detail.id, "comments", c.id);
  try {
    if (k === "report") {
      if (!(await confirmBox(`이 댓글을 ${t.report}할까요?`, "신고", true))) return;
      const repRef = doc(cRef, "reports", await myKey(detail.id));
      await runTransaction(db, async (tx) => {
        const r = await tx.get(repRef);
        if (r.exists()) throw new Error("!이미 신고한 댓글이에요.");
        const s = await tx.get(cRef);
        const cnt = s.data().reportCount + 1;
        tx.update(cRef, { reportCount: cnt, hidden: s.data().hidden || cnt >= REPORT_LIMIT });
        tx.set(repRef, { at: serverTimestamp() });
      });
      toast("신고가 접수되었어요.");
    } else if (k === "delete") {
      if (!(await confirmBox("이 댓글을 삭제할까요?", "삭제", true))) return;
      await updateDoc(cRef, { deleted: true, body: "" });
      toast("삭제했어요.");
    } else if (k === "unhide") {
      await updateDoc(cRef, { hidden: false, reportCount: 0 });
    } else if (k === "hide") {
      await updateDoc(cRef, { hidden: true });
    } else return;
    await refreshDetail();
  } catch (e) { toast(errMsg(e)); }
}

/* ───────────── 관리자 ───────────── */
async function adminClick() {
  if (isAdmin) {
    const k = await menu([
      { key: "hidden", label: "가려진 글 보기" },
      { key: "logout", label: "관리자 로그아웃", danger: true },
    ]);
    if (k === "hidden") location.hash = "#/hidden";
    if (k === "logout") { await signOut(auth); toast("로그아웃했어요."); }
    return;
  }
  const pw = await promptBox("관리자 비밀번호", { type: "password", okLabel: "로그인" });
  if (!pw) return;
  try {
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pw);
    toast("관리자로 로그인했어요.");
  } catch (e) {
    toast("비밀번호가 맞지 않아요.");
  }
}

/* ───────────── 시작 ───────────── */
$("#writeBtn").addEventListener("click", () => {
  if (!me) { toast("연결 중이에요. 잠시만요."); return; }
  openCompose();
});
$("#adminBtn").addEventListener("click", adminClick);
window.addEventListener("hashchange", route);
applyTheme();
render();

onAuthStateChanged(auth, async (u) => {
  if (!u) {
    try { await signInAnonymously(auth); }
    catch (e) { toast("연결에 실패했어요. 새로고침 해주세요."); console.error(e); }
    return;
  }
  me = u;
  const wasAdmin = isAdmin;
  isAdmin = !!u.email && u.email === ADMIN_EMAIL;
  $("#adminBtn").textContent = isAdmin ? "관리자 메뉴" : "관리자";
  document.body.classList.toggle("admin", isAdmin);
  if (wasAdmin !== isAdmin) { feed.loaded = false; detail = null; }
  if (!isAdmin && currentRoute().name === "hidden") { location.hash = "#/"; return; }
  await route();
});
