// LoL AI Runes Recomendation - Main Application Logic

const state = {
  picks: { blue: [null, null, null, null, null], red: [null, null, null, null, null] },
  bans: { blue: [null, null, null, null, null], red: [null, null, null, null, null] },
  active: null,
  runesFor: null, // Auto-follows active unless locked
  runesLocked: false, // Lock state
  champs: [],
  version: '15.20.1'
};

const CONFIG_BASE_PATH = './config/';

const bucket = (t) => (t === 'pick' ? 'picks' : 'bans');

const grid = document.getElementById('grid');
const search = document.getElementById('search');
const resetBtn = document.getElementById('reset');
const swapSidesBtn = document.getElementById('swapSides');
const activeInfo = document.getElementById('activeInfo');
const dataFilePicker = document.getElementById('dataFilePicker');
const fallbackBox = document.getElementById('fallback');
const fileStatus = document.getElementById('fileStatus');

const getImg = (c) => `https://ddragon.leagueoflegends.com/cdn/${state.version}/img/champion/${c.image.full}`;

function usedIds() {
  const out = new Set();
  ['picks', 'bans'].forEach((kind) => {
    ['blue', 'red'].forEach((side) => {
      state[kind][side].forEach((x) => {
        if (x) out.add(x.id);
      });
    });
  });
  return out;
}

function renderGrid() {
  if (!state.champs.length) {
    grid.innerHTML = '';
    return;
  }
  const q = search.value.trim().toLowerCase();
  const taken = usedIds();
  grid.innerHTML = '';
  state.champs
    .filter((c) => c.name.toLowerCase().includes(q))
    .forEach((c) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'champ';
      el.dataset.id = c.id;
      el.dataset.key = c.key;
      if (taken.has(c.id)) el.classList.add('taken');
      
      el.innerHTML = `
        <img src="${getImg(c)}" alt="${c.name}" loading="lazy">
        <div class="name">${c.name}</div>
      `;
      
      el.addEventListener('click', () => onChampionClick(c));
      
      grid.appendChild(el);
    });
}

function onChampionClick(champ) {
  if (!state.active) {
    flashInfo('First click a slot (pick or ban).');
    return;
  }
  if (usedIds().has(champ.id)) {
    flashInfo('This champion is already used.');
    return;
  }
  const { type, side, index } = state.active;
  const data = { 
    id: champ.id, 
    key: parseInt(champ.key), 
    name: champ.name, 
    img: getImg(champ) 
  };
  state[bucket(type)][side][index] = data;
  onDraftChange();
}

function flashInfo(text) {
  activeInfo.textContent = text;
  activeInfo.style.color = '#ffd37a';
  setTimeout(() => {
    activeInfo.style.color = '';
    updateActiveInfo();
  }, 1200);
}

function setupSlots() {
  document.querySelectorAll('.slot').forEach((slot) => {
    slot.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove')) {
        e.stopPropagation();
        clearSlot(slot);
        return;
      }
      
      setActive(slot);
    });
  });
  renderSlots();
}

function setActive(slot) {
  document.querySelectorAll('.slot').forEach((s) => s.classList.remove('active'));
  slot.classList.add('active');
  state.active = {
    type: slot.dataset.type,
    side: slot.dataset.side,
    index: Number(slot.dataset.index),
    el: slot,
  };
  updateActiveInfo();
  
  // Auto-update runes if not locked
  if (!state.runesLocked && state.active.type === 'pick') {
    state.runesFor = {
      type: state.active.type,
      side: state.active.side,
      index: state.active.index
    };
    updateRunesPanel();
  }
}

function updateActiveInfo() {
  positions = ["TOP", "JGL", "MID", "ADC", "SUP"]

  if (!state.active) {
    activeInfo.textContent = 'Select a slot (ban at top or pick on sides), then click a champion.';
    return;
  }
  const { type, side, index } = state.active;
  const S = side === 'blue' ? 'Blue' : 'Red';
  const T = type === 'pick' ? 'Pick' : 'Ban';
  activeInfo.textContent = `Active slot: ${T} – ${S} ${positions[index]}`;
}

function clearSlot(slot) {
  const type = slot.dataset.type;
  const side = slot.dataset.side;
  const index = Number(slot.dataset.index);
  state[bucket(type)][side][index] = null;
  
  // If we cleared the champion that was showing runes, clear runes display
  if (state.runesFor && 
      state.runesFor.type === type && 
      state.runesFor.side === side && 
      state.runesFor.index === index) {
    state.runesFor = null;
    state.runesLocked = false;
  }
  
  onDraftChange();
}

function renderSlots() {
  document.querySelectorAll('.slot').forEach((slot) => {
    const type = slot.dataset.type;
    const side = slot.dataset.side;
    const index = Number(slot.dataset.index);
    const data = state[bucket(type)][side][index];

    const img = slot.querySelector('img');
    const placeholder = slot.querySelector('.placeholder');

    if (data) {
      img.src = data.img;
      img.alt = data.name;
      slot.classList.add('filled');
      placeholder.style.display = 'none';
    } else {
      img.removeAttribute('src');
      img.alt = '';
      slot.classList.remove('filled');
      placeholder.style.display = '';
    }
  });
}

function onDraftChange() {
  renderSlots();
  renderGrid();
  updateRunesPanel();
}

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset entire draft?')) return;
  state.picks.blue = [null, null, null, null, null];
  state.picks.red = [null, null, null, null, null];
  state.bans.blue = [null, null, null, null, null];
  state.bans.red = [null, null, null, null, null];
  state.active = null;
  state.runesFor = null;
  state.runesLocked = false;
  document.querySelectorAll('.slot').forEach((s) => s.classList.remove('active'));
  updateActiveInfo();
  onDraftChange();
});

swapSidesBtn.addEventListener('click', () => {
  // Swap picks
  const tempPicks = state.picks.blue;
  state.picks.blue = state.picks.red;
  state.picks.red = tempPicks;
  
  // Swap bans
  const tempBans = state.bans.blue;
  state.bans.blue = state.bans.red;
  state.bans.red = tempBans;
  
  // Update active slot side if exists
  if (state.active) {
    state.active.side = state.active.side === 'blue' ? 'red' : 'blue';
    
    const newSlot = document.querySelector(
      `.slot[data-type="${state.active.type}"][data-side="${state.active.side}"][data-index="${state.active.index}"]`
    );
    if (newSlot) {
      document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
      newSlot.classList.add('active');
      state.active.el = newSlot;
    }
  }
  
  // Update runesFor side if exists
  if (state.runesFor) {
    state.runesFor.side = state.runesFor.side === 'blue' ? 'red' : 'blue';
  }
  
  updateActiveInfo();
  onDraftChange();
});

search.addEventListener('input', renderGrid);

dataFilePicker.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  
  fileStatus.textContent = 'Loading files...';
  fileStatus.style.color = '#ffd37a';
  
  try {
    const filesByName = {};
    
    for (const file of files) {
      filesByName[file.name] = file;
    }
    
    if (!filesByName['champions.json']) {
      throw new Error('Missing champions.json');
    }
    const champText = await filesByName['champions.json'].text();
    const champData = JSON.parse(champText);
    initWithChampions(champData);
    
    if (!filesByName['mappings.json']) {
      throw new Error('Missing mappings.json');
    }
    const mapText = await filesByName['mappings.json'].text();
    const mappingsData = JSON.parse(mapText);
    
    const requiredModels = ['keystone.onnx', 'lesser_runes.onnx', 'shards.onnx', 'summoner_spells.onnx']; // UPDATED
    const missingModels = requiredModels.filter(name => !filesByName[name]);
    
    if (missingModels.length > 0) {
      throw new Error(`Missing models: ${missingModels.join(', ')}`);
    }
    
    const modelFiles = {};
    for (const modelName of requiredModels) {
      const onnxFile = filesByName[modelName];
      const dataFile = filesByName[modelName + '.data'];
      
      modelFiles[modelName] = {
        onnx: onnxFile,
        data: dataFile
      };
    }
    
    await window.runePredictor.loadFromFiles(mappingsData, modelFiles);
    
    fileStatus.textContent = 'All files loaded ✓';
    fileStatus.style.color = '#6ee1ff';
    fallbackBox.classList.remove('show');
    updateRunesPanel();
    
  } catch (err) {
    fileStatus.textContent = 'Failed to load files';
    fileStatus.style.color = '#ff6e7a';
    console.error('File loading error:', err);
    alert('Failed to load files: ' + err.message);
  } finally {
    dataFilePicker.value = '';
  }
});

function initWithChampions(json) {
  try {
    const raw = json?.data || {};
    const arr = Object.values(raw);
    if (!arr.length) throw new Error('No champions in file.');
    state.version = json.version || arr[0].version || state.version;
    state.champs = arr.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    renderGrid();
  } catch (e) {
    alert('This file does not look like champions.json in expected format.');
    console.error(e);
  }
}

function toggleRunesLock() {
  state.runesLocked = !state.runesLocked;
  
  const lockBtn = document.getElementById('lockRunesBtn');
  if (lockBtn) {
    lockBtn.textContent = state.runesLocked ? '🔒' : '🔓';
    lockBtn.classList.toggle('locked', state.runesLocked);
    lockBtn.title = state.runesLocked ? 'Unlock (auto-follow selection)' : 'Lock to current champion';
  }
  
  // If unlocking, update to current active
  if (!state.runesLocked && state.active && state.active.type === 'pick') {
    state.runesFor = {
      type: state.active.type,
      side: state.active.side,
      index: state.active.index
    };
    updateRunesPanel();
  }
}

window.toggleRunesLock = toggleRunesLock;

function updateRunesPanel() {
  const panel = document.getElementById('runesPanelBody');
  const title = document.getElementById('runesPanelTitle');
  const hint = document.getElementById('runesPanelHint');
  
  // Add lock button to title if not exists
  if (!document.getElementById('lockRunesBtn')) {
    const lockBtn = document.createElement('button');
    lockBtn.id = 'lockRunesBtn';
    lockBtn.className = 'lockBtn';
    lockBtn.textContent = '🔓';
    lockBtn.title = 'Lock to current champion';
    lockBtn.onclick = toggleRunesLock;
    title.appendChild(lockBtn);
  }
  
  // Use runesFor if set
  if (!state.runesFor) {
    panel.innerHTML = '<div class="runesPanelEmpty">Select a pick slot to see rune predictions</div>';
    hint.textContent = 'Runes auto-update as you select champions';
    return;
  }
  
  const { side, index } = state.runesFor;
  const champ = state.picks[side][index];
  
  if (!champ) {
    panel.innerHTML = '<div class="runesPanelEmpty">Champion removed from slot</div>';
    hint.textContent = 'Select another champion to show runes';
    state.runesFor = null;
    state.runesLocked = false;
    return;
  }
  
  // Check if all picks filled
  const picks = [];
  ['blue', 'red'].forEach(s => {
    state.picks[s].forEach(p => {
      if (p) picks.push(p.key);
      else picks.push(null);
    });
  });
  
  if (picks.filter(p => p !== null).length < 10) {
    panel.innerHTML = '<div class="runesPanelEmpty">Complete all 10 picks to see runes prediction</div>';
    hint.textContent = 'Fill all 10 champion picks first';
    return;
  }
  
  // Check if models loaded
  if (!window.runePredictor || !window.runePredictor.ready) {
    panel.innerHTML = '<div class="runesPanelEmpty">Models not loaded. Use "Load Data Files" button.</div>';
    hint.textContent = 'Load model files first';
    return;
  }
  
  // Show runes
  const playerIdx = side === 'blue' ? index : index + 5;
  
  // Update title text (preserve lock button)
  const titleText = title.childNodes[0];
  if (titleText) {
    titleText.textContent = `${champ.name} - Runes `;
  }
  
  const lockStatus = state.runesLocked ? '🔒 Locked' : '🔓 Auto-updating';
  hint.textContent = `${side.toUpperCase()} ${index + 1} • ${lockStatus}`;
  
  panel.innerHTML = '<div class="loadingSpinner">Loading predictions...</div>';
  
  showRunesInPanel(champ, picks, playerIdx, state.runesLocked);
}

// Detect if running via HTTP/HTTPS (any server) or file:// protocol (local file system)
function isServed() {
  return window.location.protocol.startsWith('http');
}

// Auto-load function for served environments
async function autoLoadDataFiles() {
  fileStatus.textContent = 'Auto-loading data files...';
  fileStatus.style.color = '#ffd37a';
  
  try {
    // Load champions.json
    const champResponse = await fetch(`${CONFIG_BASE_PATH}champions.json`);
    if (!champResponse.ok) throw new Error('Failed to load champions.json');
    const champData = await champResponse.json();
    initWithChampions(champData);
    
    // Load mappings.json
    const mapResponse = await fetch(`${CONFIG_BASE_PATH}mappings.json`);
    if (!mapResponse.ok) throw new Error('Failed to load mappings.json');
    const mappingsData = await mapResponse.json();
    
    // Load all ONNX models
    const requiredModels = ['keystone.onnx', 'lesser_runes.onnx', 'shards.onnx', 'summoner_spells.onnx'];
    const modelFiles = {};
    
    for (const modelName of requiredModels) {
      const onnxResponse = await fetch(`${CONFIG_BASE_PATH}${modelName}`);
      if (!onnxResponse.ok) throw new Error(`Failed to load ${modelName}`);
      const onnxBlob = await onnxResponse.blob();
      
      // Try to load .data file (optional)
      let dataBlob = null;
      try {
        const dataResponse = await fetch(`${CONFIG_BASE_PATH}${modelName}.data`);
        if (dataResponse.ok) {
          dataBlob = await dataResponse.blob();
        }
      } catch (e) {
        console.warn(`No .data file for ${modelName}`);
      }
      
      modelFiles[modelName] = {
        onnx: new File([onnxBlob], modelName, { type: 'application/octet-stream' }),
        data: dataBlob ? new File([dataBlob], `${modelName}.data`, { type: 'application/octet-stream' }) : null
      };
    }
    
    await window.runePredictor.loadFromFiles(mappingsData, modelFiles);
    
    fileStatus.textContent = 'All files loaded ✓';
    fileStatus.style.color = '#6ee1ff';
    fallbackBox.classList.remove('show');
    updateRunesPanel();
    
  } catch (err) {
    fileStatus.textContent = 'Auto-load failed - use manual file picker below';
    fileStatus.style.color = '#ff6e7a';
    console.error('Auto-load error:', err);
    fallbackBox.classList.add('show');
  }
}

// Initialize
setupSlots();

if (isServed()) {
  autoLoadDataFiles();
} else {
  fallbackBox.classList.add('show');
  fileStatus.textContent = 'Running locally - load configuration files to start';
  fileStatus.style.color = '#ffd37a';
}