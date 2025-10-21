// ONNX Runtime inference for LoL rune prediction models

class RunePredictor {
  constructor() {
    this.sessions = {};
    this.mappings = null;
    this.ready = false;
  }

  async loadFromFiles(mappingsData, modelFiles) {
    console.log('Loading rune prediction models...');
    
    try {
      this.mappings = mappingsData;
      
      // Load each model
      for (const [modelName, files] of Object.entries(modelFiles)) {
        const onnxBuffer = await files.onnx.arrayBuffer();
        
        const options = {};
        if (files.data) {
          console.log(`Loading external data for ${modelName}`);
          const dataBuffer = await files.data.arrayBuffer();
          options.externalData = [{
            data: new Uint8Array(dataBuffer),
            path: files.data.name
          }];
        }
        
        const sessionName = modelName.replace('.onnx', '');
        this.sessions[sessionName] = await ort.InferenceSession.create(onnxBuffer, options);
        console.log(`✓ Loaded ${sessionName}`);
      }
      
      this.ready = true;
      console.log('✓ All models loaded successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to load models:', error);
      throw error;
    }
  }

  async predict(champions, playerIdx) {
    if (!this.ready) throw new Error('Models not loaded');

    const championsBlue = champions.slice(0, 5);
    const championsRed = champions.slice(5, 10);
    const playerChampion = champions[playerIdx];
    const position = playerIdx % 5;
    const side = playerIdx < 5 ? 0 : 1;

    // Convert champion keys to indices
    const champToIdx = (key) => {
      const idx = this.mappings.champion_to_idx[key];
      if (idx === undefined) throw new Error(`Unknown champion key: ${key}`);
      return idx;
    };

    const blueIdx = championsBlue.map(champToIdx);
    const redIdx = championsRed.map(champToIdx);
    const playerIdxMapped = champToIdx(playerChampion);

    // Prepare tensors
    const feeds = {
      champions_blue: new ort.Tensor('int64', new BigInt64Array(blueIdx.map(BigInt)), [1, 5]),
      champions_red: new ort.Tensor('int64', new BigInt64Array(redIdx.map(BigInt)), [1, 5]),
      player_champion: new ort.Tensor('int64', new BigInt64Array([BigInt(playerIdxMapped)]), [1]),
      position: new ort.Tensor('int64', new BigInt64Array([BigInt(position)]), [1]),
      side: new ort.Tensor('int64', new BigInt64Array([BigInt(side)]), [1])
    };

    // Run inference for all 4 models
    const keystoneOut = await this.sessions.keystone.run(feeds);
    const lesserOut = await this.sessions.lesser_runes.run(feeds);
    const shardsOut = await this.sessions.shards.run(feeds);
    const summonersOut = await this.sessions.summoner_spells.run(feeds);

    // Process outputs (all models now return probabilities, not logits)
    const keystoneProbs = Array.from(keystoneOut.output.data);
    const lesserProbs = Array.from(lesserOut.output.data);
    const shardsProbs = Array.from(shardsOut.output.data);
    const summonersProbs = Array.from(summonersOut.output.data);

    // Stat shards: reshape [9] -> 3 rows of 3
    const shardsProbsShaped = [
      shardsProbs.slice(0, 3),
      shardsProbs.slice(3, 6),
      shardsProbs.slice(6, 9)
    ];

    return {
      keystone: this.mappings.keystones.map((id, idx) => ({
        id,
        probability: keystoneProbs[idx]
      })).sort((a, b) => b.probability - a.probability),

      lesser_runes: this.mappings.lesser_runes_flat.map((id, idx) => ({
        id,
        probability: lesserProbs[idx]
      })).sort((a, b) => b.probability - a.probability),

      stat_shards: {
        offense: this.mappings.stat_shards.offense.map((id, idx) => ({
          id,
          probability: shardsProbsShaped[0][idx]
        })),
        flex: this.mappings.stat_shards.flex.map((id, idx) => ({
          id,
          probability: shardsProbsShaped[1][idx]
        })),
        defense: this.mappings.stat_shards.defense.map((id, idx) => ({
          id,
          probability: shardsProbsShaped[2][idx]
        }))
      },

      summoner_spells: this.mappings.summoner_spells.map((id, idx) => ({
        id,
        probability: summonersProbs[idx]
      })).sort((a, b) => b.probability - a.probability)
    };
  }
}

// Global instance
window.runePredictor = new RunePredictor();