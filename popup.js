const track = document.getElementById('track');
const fileRow = document.getElementById('fileRow');
const file = document.getElementById('file');
const offset = document.getElementById('offset');
const status = document.getElementById('status');

const fileHint = document.getElementById('fileHint');
const access = document.getElementById('access');

// Bundled songs are optional (copyrighted, so not shipped): only offer the ones actually present.
async function hasFile(path) {
  try { return (await fetch(chrome.runtime.getURL(path))).ok; } catch { return false; }
}

async function updateFileRow() {
  fileRow.hidden = track.value !== 'custom';
  const { customAudio } = await chrome.storage.local.get('customAudio');
  fileHint.textContent = customAudio ? 'A song is saved. Pick another file to replace it.' : 'Upload an MP3 to get started.';
}

// Small prefs go in sync; the Base64 MP3 goes in local because sync caps items at 8 KB.
(async () => {
  for (const opt of [...track.options]) {
    if (opt.value !== 'custom' && !(await hasFile(opt.value))) opt.remove();
  }
  const prefs = await chrome.storage.sync.get({ track: 'custom', offset: 0 });
  track.value = [...track.options].some((o) => o.value === prefs.track) ? prefs.track : 'custom';
  offset.value = prefs.offset;
  await updateFileRow();
  // Firefox makes site access opt-in; Chrome/Edge/Opera grant it at install, so this stays hidden there.
  access.hidden = await chrome.permissions.contains({ origins: ['<all_urls>'] });
})();

track.addEventListener('change', updateFileRow);

document.getElementById('grant').addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
  access.hidden = granted;
  if (granted) show('Access granted. Refresh your episode tab.', 'ok');
});

function readAsDataURL(f) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(f);
  });
}

function show(msg, cls) {
  status.textContent = msg;
  status.className = cls;
  setTimeout(() => { status.textContent = ''; }, 3000);
}

// Sends a message to every frame of the current tab; resolves with the first answer (or undefined).
async function ask(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, msg, (r) => resolve(chrome.runtime.lastError ? undefined : r));
  });
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Asks the frame playing the video how far from the end it is; the page saves it for this show.
document.getElementById('mark').addEventListener('click', async () => {
  const fromEnd = await ask('streamHelper:mark');
  if (typeof fromEnd !== 'number') return show('No video found on this tab.', 'err');
  show(`Saved for this show: ${Math.round(fromEnd)}s before the end.`, 'ok');
});

const confirmBox = document.getElementById('confirm');
let pending = null; // AniSkip submission waiting for the user to confirm

document.getElementById('end').addEventListener('click', async () => {
  const times = await ask('streamHelper:end');
  if (!times) return show('Press "Outro starts now" on this episode first.', 'err');
  const ep = await ask('streamHelper:episode');
  if (!ep) return show("Couldn't find this episode on MyAnimeList, so it can't be shared.", 'err');
  pending = { ...ep, ...times };
  document.getElementById('confirmText').textContent =
    `Share ending ${fmt(times.start)} → ${fmt(times.end)} for episode ${ep.episode} on AniSkip? It will be public.`;
  confirmBox.hidden = false;
});

document.getElementById('cancel').addEventListener('click', () => {
  confirmBox.hidden = true;
  pending = null;
});

document.getElementById('send').addEventListener('click', async () => {
  confirmBox.hidden = true;
  const p = pending;
  pending = null;
  try {
    // AniSkip requires an anonymous per-install id.
    let { submitterId } = await chrome.storage.local.get('submitterId');
    if (!submitterId) {
      submitterId = crypto.randomUUID();
      await chrome.storage.local.set({ submitterId });
    }
    const res = await fetch(`https://api.aniskip.com/v2/skip-times/${p.malId}/${p.episode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skipType: 'ed',
        providerName: p.provider,
        startTime: p.start,
        endTime: p.end,
        episodeLength: p.episodeLength,
        submitterId,
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.status);
    show('Shared on AniSkip. Thanks!', 'ok');
  } catch (e) {
    show('AniSkip submit failed: ' + e.message, 'err');
  }
});

document.getElementById('save').addEventListener('click', async () => {
  try {
    if (track.value === 'custom') {
      if (file.files[0]) {
        await chrome.storage.local.set({ customAudio: await readAsDataURL(file.files[0]) });
      } else if (!(await chrome.storage.local.get('customAudio')).customAudio) {
        return show('Choose an MP3 file first.', 'err');
      }
    }
    await chrome.storage.sync.set({
      track: track.value,
      offset: Math.max(0, Number(offset.value) || 0),
    });
    show('Saved!', 'ok');
    updateFileRow();
  } catch (e) {
    show('Save failed: ' + e.message, 'err');
  }
});
