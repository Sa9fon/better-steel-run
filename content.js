const OUTRO_DURATION = 90; // manual mode: seconds the replacement track covers
const DRIFT = 0.3;         // resync audio if it drifts more than this (seconds)

// Sites the extension works on (hostname suffixes, mirrors included). The script is injected into
// every frame of every page so it can reach any player iframe (their domains change constantly),
// but it stays inert unless the top page is one of these.
const SITES = [
  'netflix.com', 'crunchyroll.com', 'bilibili.tv',
  'anikototv.to', 'animepahe.pw', 'animepahe.com', 'animepahe.org', 'reanime.to', 'reanime.cz', 'reanime.wtf',
  'miruro.to', 'miruro.bz', 'miruro.cx', 'miruro.tv', 'mkissa.to', 'allmanga.to', 'anizone.to', 'senshi.to',
  'kaa.to', 'kaa.lt', 'kaa.mx', 'kaa.rs', 'aniwaves.ru', 'anime.nexus', 'animenexus.tv', 'ani.pm',
  'animeonsen.xyz', 'shiro.so', 'anify.to', 'anisnatch.to', 'anisnatch.top', 'anisnatch.site', 'animex.one',
  '4anime.com.ro', '4anime.to', '4anime.gg', '9anime.to', '9animetv.to',
];

// The only show the extension acts on; every other episode is left alone.
const ONLY_SHOW = /steel\s*ball\s*run/i;

// Per-site hints where the generic page reading below gets it wrong.
const SITE_RULES = {
  'crunchyroll.com': { // one series page for all seasons; the title says "Season 2 <episode title>"
    name: () => {
      const series = document.querySelector('a[href*="/series/"]')?.textContent;
      const season = Number(document.title.match(/^Season (\d+)/)?.[1]);
      return series && season > 1 ? `${series} Season ${season}` : series;
    },
    episode: () => [...document.querySelectorAll('h1')].map((h) => h.textContent.match(/^E(\d+)\s*-/)?.[1]).find(Boolean),
  },
  'ani.pm': { episode: () => document.querySelector('h1')?.textContent.match(/^(\d+)\./)?.[1] }, // "14.Resolve"; ?ep= is a token
  'shiro.so': { anilistId: () => location.pathname.match(/^\/anime\/(\d+)-/)?.[1] },
};

// null = unknown: Firefox has no ancestorOrigins, so its frames just wait for a supported top page to answer.
function topHostname() {
  if (window === top) return location.hostname;
  const origins = location.ancestorOrigins;
  if (!origins) return null;
  try { return new URL(origins[origins.length - 1]).hostname; } catch { return ''; }
}
const matchSite = (host) => (list) => list.find((s) => host === s || host.endsWith('.' + s));
const HOST = topHostname();
const ENABLED = HOST === null || !!matchSite(HOST)(SITES);
const rule = SITE_RULES[matchSite(HOST || '')(Object.keys(SITE_RULES))] || {};

let OFFSET_BEFORE_END = 0; // manual fallback from the popup; 0 = off
let src = null;    // bundled track URL or Base64 data URL
let video = null;
let audio = null;
let active = false; // true while we own the outro (native muted, our track playing)
let auto;           // resolved ending: undefined = still looking, null = none, else { fromEnd, length }
let markStart = null; // this episode's "Outro starts now" time, waiting for "Outro ends now"
let showKey = 'outro:' + location.hostname; // top frame: storage key for per-show marks
let lookup = { href: null }; // top frame: episode lookup for the current URL (promises)
let lastHref = null;
let ticks = 0;
let started = false;

// No song chosen yet -> src stays null and nothing is ever muted.
async function loadPrefs() {
  const p = await chrome.storage.sync.get({ track: 'custom', offset: 0 });
  OFFSET_BEFORE_END = Math.max(0, Number(p.offset) || 0);
  src = p.track === 'custom'
    ? (await chrome.storage.local.get('customAudio')).customAudio || null
    : chrome.runtime.getURL(p.track);
}

// ---- Reading the episode from the page (top frame) ----

// Show name from the page title or heading, e.g. "Watch Frieren Episode 3 English Sub | Site" -> "Frieren".
function cleanName(s) {
  const site = HOST.replace(/^www\./, '').split('.')[0].toLowerCase();
  const parts = (s || '').replace(/\s+/g, ' ').split(/ [|·—–-] /).map((p) => p
    .replace(/^watch\s+/i, '')
    .replace(/^ep(isode)?\.?\s*\d+\s*[:.-].*$/i, '')          // "Episode 1: I'm Luffy!" is the episode's title
    .replace(/^ep(isode)?\.?\s*\d+\s*[.:-]?\s*/i, '')        // "EP 14 Name"
    .replace(/\s*\bep(isode)?\b\.?(\s*\d+)?.*$/i, '')          // "Name Episode 14 English Sub..."
    .replace(/\s*\((19|20)\d\d\)/, '')                         // "(2026)"
    .replace(/\s*\b(english )?(sub|dub)(bed)?\b.*$/i, '')
    .trim());
  const good = parts.filter((p) => p.length > 1 && p.toLowerCase().replace(/\W/g, '') !== site && !/^(watch|online|free|home)\b/i.test(p));
  return good.sort((a, b) => b.length - a.length)[0] || null;
}

// Name candidates: site rule, a heading that the title confirms (pages also have headings like
// "Episodes" or "Comments"), the 4anime-style URL slug, then the title itself.
function pageName() {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const title = norm(document.title);
  const h1 = [...document.querySelectorAll('h1')].map((h) => cleanName(h.textContent)).find((n) => n && title.includes(norm(n)));
  const slug = location.pathname.match(/^\/(.+?)-episode-\d+/)?.[1].replace(/-/g, ' ');
  for (const c of [rule.name?.(), h1, slug, document.title]) {
    const n = cleanName(c);
    if (n) return n;
  }
  return null;
}

// Episode number: site rule, then the URL (/ep-14, -episode-14, /p-14-sub, ?ep=14, /watch/<id>/14), then the title.
function episodeNumber() {
  const ruled = rule.episode?.();
  if (ruled) return Number(ruled);
  const u = location.pathname + location.search;
  const m = u.match(/\/ep-(\d+)|-episode-(\d+)|\/episode-(\d+)|\/p-(\d+)-(?:sub|dub|raw)|[?&]ep=(\d+)(?:&|$)|\/(?:anime|watch)\/[^/]+\/(\d+)\/?(?:\?|$)/i);
  if (m) return Number(m.slice(1).find(Boolean));
  const t = `${document.title} ${document.querySelector('h1')?.textContent || ''}`.match(/\bep(?:isode)?\.?\s*(\d+)/i);
  return t ? Number(t[1]) : null;
}

// A MyAnimeList/AniList id linked from the page, only if exactly one (else it may be a related show).
function linkedId(re) {
  const ids = new Set([...document.querySelectorAll('a[href]')].map((a) => a.href.match(re)?.[1]).filter(Boolean));
  return ids.size === 1 ? Number([...ids][0]) : null;
}

// AniList allows ~30 requests a minute, so each lookup should cost one or two.
async function anilist(query, variables) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()).data;
}

// Name -> MyAnimeList id. One search returns up to 10 candidates, ranked here: the page's "(2026)"
// picks the season, TV series beat same-named mini-series/movies, and entries with fewer episodes
// than this one are skipped. No results (titles mangle punctuation) -> retry with trailing words dropped.
async function searchMalId(name, episode) {
  const year = Number(`${document.title} ${document.querySelector('h1')?.textContent}`.match(/\(((?:19|20)\d\d)\)/)?.[1]) || null;
  const words = (name || '').replace(/[‘’]/g, "'").split(' ').filter(Boolean);
  const tv = (m) => m.format === 'TV' || m.format === 'TV_SHORT';
  for (let n = words.length; n >= Math.min(2, words.length) && n > 0; n--) {
    const data = await anilist('query($s:String){Page(perPage:10){media(search:$s,type:ANIME){idMal format seasonYear episodes}}}',
      { s: words.slice(0, n).join(' ') });
    const list = (data?.Page?.media || []).filter((m) => m.idMal && !(m.episodes && m.episodes < episode));
    if (list.length) {
      return (list.find((m) => year && m.seasonYear === year && tv(m)) || list.find((m) => year && m.seasonYear === year)
        || list.find(tv) || list[0]).idMal;
    }
  }
  return null;
}

// Page -> { malId, episode }. Also used by the popup to submit to AniSkip.
async function findEpisode(name) {
  const episode = episodeNumber();
  if (!episode) return null;
  let malId = linkedId(/myanimelist\.net\/anime\/(\d+)/);
  const anilistId = !malId && (Number(rule.anilistId?.()) || linkedId(/anilist\.co\/anime\/(\d+)/));
  if (anilistId) malId = (await anilist('query($id:Int){Media(id:$id,type:ANIME){idMal}}', { id: anilistId }))?.Media?.idMal;
  if (!malId) malId = await searchMalId(name, episode);
  return malId ? { malId, episode, provider: HOST } : null;
}

// Episode -> best-voted ending timestamps (AniSkip).
async function lookupOutro(ep) {
  if (!ep) return null;
  const skip = await (await fetch(
    `https://api.aniskip.com/v2/skip-times/${ep.malId}/${ep.episode}?types=ed&episodeLength=0`
  )).json();
  const ed = skip.results?.[0];
  if (!ed) return null;
  // Measured from the end, so it still lines up if this site's copy has extra seconds at the start.
  return { fromEnd: ed.episodeLength - ed.interval.startTime, length: ed.interval.endTime - ed.interval.startTime };
}

// Is this page an episode of ONLY_SHOW? Checks the title, URL, headings and Netflix's player title.
function isTargetShow() {
  const text = [document.title, location.pathname.replace(/[-_]/g, ' '),
    ...[...document.querySelectorAll('h1, [data-uia="video-title"]')].map((e) => e.textContent)].join(' ');
  return ONLY_SHOW.test(text);
}

// Priority: AniSkip (community-voted), then the user's per-show mark, then the popup offset.
// Lookups are cached per URL; single-page sites change the URL without reloading.
async function resolveAuto() {
  const href = location.href;
  if (!isTargetShow()) { auto = { off: true }; return; } // another show: do nothing
  if (lookup.href !== href) {
    const name = pageName();
    const info = findEpisode(name).catch(() => null);
    lookup = { href, name, info, found: info.then(lookupOutro).catch(() => null) };
    showKey = 'outro:' + (linkedId(/myanimelist\.net\/anime\/(\d+)/) || name?.toLowerCase() || location.hostname);
  }
  const found = await lookup.found;
  const mark = (await chrome.storage.sync.get(showKey))[showKey];
  if (href !== location.href) return; // navigated meanwhile; a newer resolve takes over
  auto = found || (mark ? { fromEnd: mark, length: OUTRO_DURATION } : null);
  console.log(`[Better Steel Run] ${lookup.name || '?'} ep ${(await lookup.info)?.episode ?? '?'}:`,
    found ? 'AniSkip' : mark ? 'your mark' : 'none', auto || 'using popup offset');
}

// ---- Playback ----

// The episode is the longest video (skips pre-roll ads); looks inside shadow DOMs (e.g. Miruro) now and then.
function findVideo() {
  let best = null;
  const consider = (v) => { if (v.readyState > 0 && !(best?.duration >= v.duration)) best = v; };
  document.querySelectorAll('video').forEach(consider);
  if (!best && ticks % 8 === 0) {
    const walk = (root) => root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) { el.shadowRoot.querySelectorAll('video').forEach(consider); walk(el.shadowRoot); }
    });
    walk(document);
  }
  return best || (video?.isConnected ? video : null);
}

function stop() {
  if (!active) return;
  active = false;
  audio.pause();
  audio = null;
  if (video) video.muted = false;
}

function tick() {
  ticks++;
  if (window === top && location.href !== lastHref) { // new page or SPA navigation: re-read once the page settles
    lastHref = location.href;
    auto = undefined;
    setTimeout(resolveAuto, 1500);
  }
  if (window !== top && ticks % 4 === 0) top.postMessage('streamHelper:need', '*'); // keep in sync with the top frame
  // Titles can render late (Netflix shows its title with the controls): re-check a page marked "other show".
  if (window === top && auto?.off && ticks % 20 === 0 && isTargetShow()) resolveAuto();

  const v = findVideo();
  if (v !== video) { stop(); video = v; } // player swapped (next episode, etc.)
  if (!video || !src) return;
  if (auto === undefined || auto?.off) return stop(); // not known yet to be the target show, or another show

  const [fromEnd, length] = auto ? [auto.fromEnd, auto.length] : [OFFSET_BEFORE_END, OUTRO_DURATION];
  if (!fromEnd) return stop(); // no AniSkip data, no mark, and manual offset is off
  if (!(video.duration > fromEnd)) return stop(); // too short to be the episode (pre-roll ad) or duration unknown

  const t = video.currentTime - (video.duration - fromEnd);
  if (!(t >= 0 && t < length)) return stop(); // outside window, or duration not known yet

  if (!active) {
    if (video.muted) return; // user muted it (or a muted autoplay preview): leave alone
    active = true;
    audio = new Audio(src);
    audio.onerror = () => { src = null; stop(); }; // e.g. a bundled song file that isn't there: give the sound back
  }

  video.muted = true; // re-apply: site UIs sometimes unmute on their own
  audio.volume = video.volume;
  audio.playbackRate = video.playbackRate;

  if (audio.duration && t >= audio.duration) return audio.pause(); // song shorter than window

  if (Math.abs(audio.currentTime - t) > DRIFT) audio.currentTime = t; // scrub inside window
  if (video.paused || video.seeking) audio.pause();
  else if (audio.paused) audio.play().catch(() => {});
}

if (ENABLED) {
  // Any pref change: reload, drop the current track; the next tick restarts it with new settings.
  chrome.storage.onChanged.addListener(() => {
    if (window === top) resolveAuto(); // a new mark may apply
    loadPrefs().then(stop);
  });

  // Only the top frame knows the episode; player iframes ask it for the result.
  window.addEventListener('message', (e) => {
    if (window === top) {
      if (e.data === 'streamHelper:need' && auto !== undefined) e.source.postMessage({ streamHelper: auto }, '*');
      if (typeof e.data?.streamHelperMark === 'number') chrome.storage.sync.set({ [showKey]: e.data.streamHelperMark });
    } else if (e.data && typeof e.data === 'object' && 'streamHelper' in e.data) {
      auto = e.data.streamHelper;
      start(); // Firefox frames start once a supported top page answers
    }
  });

  // Popup buttons. Messages go to every frame; only the frame that can answer responds.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg === 'streamHelper:episode' && window === top) {
      if (!isTargetShow()) return sendResponse(null); // other shows are never looked up
      (lookup.info || findEpisode(pageName()).catch(() => null)).then(sendResponse);
      return true; // async response
    }
    if (!video || !(video.duration > video.currentTime)) return;

    if (msg === 'streamHelper:mark') {
      // Saved for the whole show (top frame owns the key), and remembered as this episode's start.
      markStart = video.currentTime;
      const fromEnd = video.duration - video.currentTime;
      sendResponse(fromEnd);
      if (window === top) chrome.storage.sync.set({ [showKey]: fromEnd });
      else top.postMessage({ streamHelperMark: fromEnd }, '*');
    } else if (msg === 'streamHelper:end' && markStart !== null && video.currentTime > markStart) {
      sendResponse({ start: markStart, end: video.currentTime, episodeLength: video.duration });
      markStart = null; // one submission per mark
    }
  });

  // Frames that can't tell their top site (Firefox) stay idle, only pinging the top page, until it answers.
  if (HOST === null) setInterval(() => { if (!started) top.postMessage('streamHelper:need', '*'); }, 2000);
  else start();
}

function start() {
  if (started) return;
  started = true;
  loadPrefs().then(() => setInterval(tick, 250));
}
