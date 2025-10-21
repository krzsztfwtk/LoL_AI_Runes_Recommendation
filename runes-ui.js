// Runes UI - Panel display

let runesMetadata = null;
let currentPredictions = null;
let selectedPrimaryStyle = null;
let selectedSecondaryStyle = null;

const STYLE_IDS = [8100, 8300, 8400, 8000, 8200];

async function loadRunesMetadata() {
  if (runesMetadata) return runesMetadata;
  
  try {
    const runesRes = await fetch('https://ddragon.leagueoflegends.com/cdn/15.20.1/data/en_US/runesReforged.json');
    const runesData = await runesRes.json();

    const summonersRes = await fetch('https://ddragon.leagueoflegends.com/cdn/15.20.1/data/en_US/summoner.json');
    const summonersData = await summonersRes.json();
    
    runesMetadata = {
      perks: {},
      styles: {},
      stylesByKey: {},
      statShards: {
        5008: { name: 'Adaptive Force', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodsadaptiveforceicon.png' },
        5005: { name: 'Attack Speed', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodsattackspeedicon.png' },
        5007: { name: 'Ability Haste', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodscdrscalingicon.png' },
        5010: { name: 'Movement Speed', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodsmovementspeedicon.png' },
        5001: { name: 'Scaling Health', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodshealthplusicon.png' },
        5011: { name: 'Bonus Health', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodshealthscalingicon.png' },
        5013: { name: 'Tenacity & Slow Resist', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodstenacityicon.png' },
        5002: { name: 'Armor', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodsarmoricon.png' },
        5003: { name: 'Magic Resist', icon: 'https://raw.communitydragon.org/15.20/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodsmagicresicon.png' }
      },
      summonerSpells: {}
    };
    
    const baseUrl = 'https://ddragon.leagueoflegends.com/cdn/img/';
    runesData.forEach(style => {
      runesMetadata.styles[style.id] = {
        id: style.id,
        key: style.key,
        name: style.name,
        icon: baseUrl + style.icon
      };
      runesMetadata.stylesByKey[style.key] = style.id;
      
      style.slots.forEach(slot => {
        slot.runes.forEach(rune => {
          runesMetadata.perks[rune.id] = {
            name: rune.name,
            icon: baseUrl + rune.icon
          };
        });
      });
    });

    const summonerBaseUrl = 'https://ddragon.leagueoflegends.com/cdn/15.20.1/img/spell/';
    for (const [name, spell] of Object.entries(summonersData.data)) {
      const spellId = parseInt(spell.key);
      runesMetadata.summonerSpells[spellId] = {
        id: spellId,
        name: spell.name,
        icon: summonerBaseUrl + spell.image.full
      };
    }
    
    return runesMetadata;
  } catch (error) {
    console.error('Failed to load runes metadata:', error);
    throw error;
  }
}

async function showRunesInPanel(champ, picks, playerIdx) {
  const panel = document.getElementById('runesPanelBody');
  
  try {
    await loadRunesMetadata();
    currentPredictions = await window.runePredictor.predict(picks, playerIdx);
    
    const bestKeystone = currentPredictions.keystone[0];
    
    selectedPrimaryStyle = findStyleForRune(bestKeystone.id);
    selectedSecondaryStyle = findBestSecondaryStyle();
    
    renderRunesInterface(panel);
  } catch (err) {
    panel.innerHTML = `<div class="errorMsg">Error: ${err.message}</div>`;
    console.error('Prediction error:', err);
  }
}

function findStyleForRune(runeId) {
  const mappings = window.runePredictor.mappings;
  for (const [styleId, slots] of Object.entries(mappings.runes_by_style)) {
    for (const slot of slots) {
      if (slot.includes(runeId)) {
        return parseInt(styleId);
      }
    }
  }
  return null;
}

function findBestSecondaryStyle() {
  const mappings = window.runePredictor.mappings;
  const styleProbabilities = {};
  
  for (const [styleId, slots] of Object.entries(mappings.runes_by_style)) {
    const style = parseInt(styleId);
    if (style === selectedPrimaryStyle) continue;
    
    styleProbabilities[style] = 0;
    
    for (let slotIdx = 1; slotIdx < slots.length; slotIdx++) {
      for (const runeId of slots[slotIdx]) {
        const rune = currentPredictions.lesser_runes.find(r => r.id === runeId);
        if (rune) {
          styleProbabilities[style] += rune.probability;
        }
      }
    }
  }
  
  let bestStyle = null;
  let bestProb = 0;
  for (const [styleId, prob] of Object.entries(styleProbabilities)) {
    if (prob > bestProb) {
      bestProb = prob;
      bestStyle = parseInt(styleId);
    }
  }
  
  return bestStyle;
}

function renderRunesInterface(container) {
  const mappings = window.runePredictor.mappings;
  
  let html = '<div class="runesInterface">';
  
  // Style selection
  html += '<div class="styleSelection">';
  html += '<div class="styleLabel" style="margin-right: 12px;">Primary:</div>';
  html += '<div class="styleTabs">';
  
  STYLE_IDS.forEach(styleId => {
    const style = runesMetadata.styles[styleId];
    const isSelected = styleId === selectedPrimaryStyle;
    html += `
      <button class="styleTab ${isSelected ? 'active' : ''}" onclick="selectPrimaryStyle(${styleId})">
        <img src="${style.icon}" alt="${style.name}" title="${style.name}">
      </button>
    `;
  });
  
  html += '</div>';
  
  html += '<div class="styleLabel" style="margin-left: 32px; margin-right: 12px;">Secondary:</div>';
  html += '<div class="styleTabs">';
  
  STYLE_IDS.forEach(styleId => {
    if (styleId === selectedPrimaryStyle) return;
    const style = runesMetadata.styles[styleId];
    const isSelected = styleId === selectedSecondaryStyle;
    html += `
      <button class="styleTab ${isSelected ? 'active' : ''}" onclick="selectSecondaryStyle(${styleId})">
        <img src="${style.icon}" alt="${style.name}" title="${style.name}">
      </button>
    `;
  });
  
  html += '</div></div>';
  
  html += '<div class="runesLayout">';
  
  // PRIMARY
  if (selectedPrimaryStyle) {
    const primarySlots = mappings.runes_by_style[selectedPrimaryStyle];
    
    html += '<div class="runeTree primary">';
    html += `<h3>${runesMetadata.styles[selectedPrimaryStyle].name}</h3>`;
    
    html += '<div class="runeSlot keystoneSlot">';
    primarySlots[0].forEach(runeId => {
      const rune = currentPredictions.keystone.find(r => r.id === runeId);
      if (rune) {
        const meta = runesMetadata.perks[runeId];
        const opacity = Math.max(0.3, rune.probability);
        const isTop = rune === currentPredictions.keystone[0];
        
        html += `
          <div class="runeOption ${isTop ? 'top' : ''}" style="opacity: ${opacity}">
            <img src="${meta.icon}" alt="">
            <div class="runeProb">${(rune.probability * 100).toFixed(1)}%</div>
            <div class="runeTooltip">${meta.name}</div>
          </div>
        `;
      }
    });
    html += '</div>';
    
    for (let slotIdx = 1; slotIdx < primarySlots.length; slotIdx++) {
      html += '<div class="runeSlot">';
      primarySlots[slotIdx].forEach(runeId => {
        const rune = currentPredictions.lesser_runes.find(r => r.id === runeId);
        if (rune) {
          const meta = runesMetadata.perks[runeId];
          const opacity = Math.max(0.3, rune.probability * 5);
          const isTop = rune.probability > 0.02;
          
          html += `
            <div class="runeOption small ${isTop ? 'top' : ''}" style="opacity: ${opacity}">
              <img src="${meta.icon}" alt="">
              <div class="runeProb">${(rune.probability * 100).toFixed(1)}%</div>
              <div class="runeTooltip">${meta.name}</div>
            </div>
          `;
        }
      });
      html += '</div>';
    }
    
    html += '</div>';
  }
  
  // SECONDARY
  if (selectedSecondaryStyle) {
    const secondarySlots = mappings.runes_by_style[selectedSecondaryStyle];
    
    html += '<div class="runeTree secondary">';
    html += `<h3>${runesMetadata.styles[selectedSecondaryStyle].name}</h3>`;
    
    for (let slotIdx = 1; slotIdx < secondarySlots.length; slotIdx++) {
      html += '<div class="runeSlot">';
      secondarySlots[slotIdx].forEach(runeId => {
        const rune = currentPredictions.lesser_runes.find(r => r.id === runeId);
        if (rune) {
          const meta = runesMetadata.perks[runeId];
          const opacity = Math.max(0.3, rune.probability * 5);
          const isTop = rune.probability > 0.02;
          
          html += `
            <div class="runeOption small ${isTop ? 'top' : ''}" style="opacity: ${opacity}">
              <img src="${meta.icon}" alt="">
              <div class="runeProb">${(rune.probability * 100).toFixed(1)}%</div>
              <div class="runeTooltip">${meta.name}</div>
            </div>
          `;
        }
      });
      html += '</div>';
    }
    
    html += '</div>';
  }
  
  // SHARDS
  html += '<div class="runeTree shards">';
  html += '<h3>Shards</h3>';
  
  ['offense', 'flex', 'defense'].forEach(type => {
    html += '<div class="shardRow">';
    html += '<div class="shardRowInner">';
    currentPredictions.stat_shards[type].forEach(shard => {
      const meta = runesMetadata.statShards[shard.id];
      const opacity = Math.max(0.3, shard.probability);
      const maxProb = Math.max(...currentPredictions.stat_shards[type].map(s => s.probability));
      const isTop = shard.probability === maxProb;
      
      html += `
        <div class="shardOption ${isTop ? 'top' : ''}" style="opacity: ${opacity}">
          <img src="${meta.icon}" alt="">
          <div class="shardProb">${(shard.probability * 100).toFixed(1)}%</div>
          <div class="runeTooltip">${meta.name}</div>
        </div>
      `;
    });
    html += '</div></div>';
  });
  
  html += '</div>';
  
  // SUMMONER SPELLS
  html += '<div class="runeTree summoners">';
  html += '<h3>Summoner Spells</h3>';
  
  html += '<div class="summonerRow">';
  currentPredictions.summoner_spells.forEach(spell => {
    const meta = runesMetadata.summonerSpells[spell.id];
    if (!meta) return; // Skip if metadata not found
    
    const opacity = Math.max(0.3, spell.probability);
    const top2 = currentPredictions.summoner_spells.slice(0, 2);
    const isTop = top2.includes(spell);
    
    html += `
      <div class="summonerOption ${isTop ? 'top' : ''}" style="opacity: ${opacity}">
        <img src="${meta.icon}" alt="">
        <div class="summonerProb">${(spell.probability * 100).toFixed(1)}%</div>
        <div class="runeTooltip">${meta.name}</div>
      </div>
    `;
  });
  html += '</div>';
  
  html += '</div>';
  
  html += '</div></div>';
  
  container.innerHTML = html;
}

function selectPrimaryStyle(styleId) {
  if (styleId === selectedSecondaryStyle) {
    selectedSecondaryStyle = selectedPrimaryStyle;
  }
  selectedPrimaryStyle = styleId;
  const panel = document.getElementById('runesPanelBody');
  renderRunesInterface(panel);
}

function selectSecondaryStyle(styleId) {
  selectedSecondaryStyle = styleId;
  const panel = document.getElementById('runesPanelBody');
  renderRunesInterface(panel);
}

window.selectPrimaryStyle = selectPrimaryStyle;
window.selectSecondaryStyle = selectSecondaryStyle;