// src/classes/GameState.js - Enhanced with WFC Integration
export class GameState {
  constructor(gameObj) {
    this.game = gameObj;
    this.game.connections = {};
    this.wfc = null;
    this.terrainGrid = null;
  }

  updateGold(amount) {
    this.game.gold += amount;
  }

  setGold(amount) {
    this.game.gold = amount;
  }

  updateDay(amount = 1) {
    this.game.day += amount;
  }

  setLocation(locationIndex) {
    this.game.location = locationIndex;
  }

  updateStock(itemId, amount) {
    this.game.stock[itemId] = (this.game.stock[itemId] || 0) + amount;
  }

  setStock(itemId, amount) {
    this.game.stock[itemId] = amount;
  }

  addToInventory(itemId, quantity, price) {
    for (let i = 0; i < quantity; i++) {
      this.game.inventory.push({ id: itemId, price: price });
    }
  }

  removeFromInventory(itemId, quantity) {
    for (let i = 0; i < quantity; i++) {
      const index = this.game.inventory.findIndex((item) => item.id === itemId);
      if (index !== -1) {
        this.game.inventory.splice(index, 1);
      }
    }
  }

  clearInventory() {
    this.game.inventory = [];
  }

  getAveragePurchasePrice(itemId) {
    const items = this.game.inventory.filter((item) => item.id === itemId);
    if (items.length === 0) return null;

    const totalCost = items.reduce((sum, item) => sum + item.price, 0);
    return Math.round(totalCost / items.length);
  }

  updateSaturation(key, amount) {
    this.game.saturation[key] = (this.game.saturation[key] || 0) + amount;
  }

  setSaturation(key, amount) {
    this.game.saturation[key] = amount;
  }

  clearSaturation(key) {
    delete this.game.saturation[key];
  }

  decaySaturation() {
    const decayRate = this.game.rules.pricing.saturation.decayRate;
    Object.keys(this.game.saturation).forEach((key) => {
      this.game.saturation[key] = Math.max(0, this.game.saturation[key] - decayRate);
      if (this.game.saturation[key] === 0) {
        this.clearSaturation(key);
      }
    });
  }

  setPrices(prices) {
    this.game.prices = prices;
  }

  setPrice(itemId, price) {
    this.game.prices[itemId] = price;
  }

  setSeed(seed) {
    this.game.seed = seed;
  }

  reset() {
    this.game.day = 1;
    this.game.gold = this.game.rules.gameplay.startingGold;
    this.game.location = 0;
    this.game.inventory = [];
    this.game.saturation = {};
    this.game.currentQuest = null;
    this.game.seed = Date.now() % 10000;
    this.wfc = null;
    this.terrainGrid = null;
  }

  // ✅ NEW: WFC World Generation
  async generateWFCWorld(onProgress = null) {
    try {
      // Load WFC classes and data
      const { WFCLoader } = await import('./WFCLoader.js');
      await WFCLoader.initialize();

      // Create WFC instance
      const gridSize = Math.min(12, Math.max(8, this.game.rules.grid.width || 8));
      this.wfc = new window.WaveFunctionCollapse(gridSize, gridSize, 'fantasy');
      this.wfc.autoSpeed = 50; // Fast generation for gameplay

      // Report progress
      if (onProgress) onProgress("Generating terrain...", 0);

      // Generate the world
      const success = await this.wfc.autoGenerate();
      
      if (!success) {
        throw new Error("Failed to generate valid world");
      }

      if (onProgress) onProgress("Placing locations...", 50);

      // Convert WFC data to trading sim format
      this.convertWFCToGameState();

      if (onProgress) onProgress("Finalizing world...", 100);

      console.log("✅ WFC world generated successfully");
      console.log("📍 Locations:", this.game.locations.map(l => l.name));
      console.log("🔗 Connections:", this.game.connections);

      return true;
    } catch (error) {
      console.error("❌ WFC world generation failed:", error);
      // Fallback to old generation method
      this.generateLocations();
      return false;
    }
  }

  // Convert WFC output to trading sim data structures
  convertWFCToGameState() {
    if (!this.wfc || !this.wfc.placedLocations) {
      throw new Error("No WFC data to convert");
    }

    // Store terrain grid for price calculations
    this.terrainGrid = this.wfc.grid.map(row => 
      row.map(cell => cell.terrain)
    );

    // Convert WFC locations to trading sim locations
    this.game.locations = [];
    this.game.locationGrid = Array(this.wfc.height).fill().map(() => 
      Array(this.wfc.width).fill(null)
    );

    // Map WFC locations to trading sim location templates
    this.wfc.placedLocations.forEach((wfcLoc, index) => {
      const { x, y, loc } = wfcLoc;
      
      // Find matching template in game data
      const template = this.game.gameData.locationTemplates.find(t => 
        t.id === loc.id || t.name === loc.label || t.name === loc.name
      );

      if (template) {
        // Use template with WFC position data
        const location = {
          ...template,
          x: x,
          y: y,
          terrain: this.terrainGrid[y][x],
          wfcData: loc
        };
        
        this.game.locations.push(location);
        this.game.locationGrid[y][x] = index;
      } else {
        // Create new location from WFC data
        const location = {
          id: loc.id,
          name: loc.label || loc.name,
          emoji: loc.emoji,
          description: `A ${loc.label || loc.name} nestled in the ${this.terrainGrid[y][x]}`,
          flavorText: "A place of mystery and opportunity",
          multipliers: { basic: 1.0, quality: 1.0, premium: 1.0 },
          travelTime: 1,
          distanceTier: 2,
          x: x,
          y: y,
          terrain: this.terrainGrid[y][x],
          wfcData: loc
        };
        
        this.game.locations.push(location);
        this.game.locationGrid[y][x] = index;
      }
    });

    // Ensure we start at location 0
    if (this.game.locations.length > 0) {
      this.game.location = 0;
    }

    // Build connection graph based on terrain adjacency
    this.buildWFCConnections();

    // Set world name from WFC
    if (this.wfc.mapName) {
      this.game.worldName = this.wfc.mapName;
    }
  }

  // Build connections based on WFC grid positions
  buildWFCConnections() {
    this.initializeConnections();
    
    for (let i = 0; i < this.game.locations.length; i++) {
      for (let j = i + 1; j < this.game.locations.length; j++) {
        const locA = this.game.locations[i];
        const locB = this.game.locations[j];
        
        // Calculate grid distance
        const dx = Math.abs(locA.x - locB.x);
        const dy = Math.abs(locA.y - locB.y);
        const distance = dx + dy;
        
        // Connect if within reasonable distance
        if (distance <= 4) {
          this.game.connections[i].push(j);
          this.game.connections[j].push(i);
        }
      }
    }

    // Ensure world is connected
    this.ensureWorldConnected();
  }

  // Enhanced price calculation with terrain bonuses
  getTerrainPriceMultiplier(itemId, locationIndex) {
    if (!this.terrainGrid || !this.game.locations[locationIndex]) {
      return 1.0;
    }

    const location = this.game.locations[locationIndex];
    const terrain = location.terrain;
    const terrainMultipliers = this.game.gameData.terrainMultipliers;

    if (terrainMultipliers && terrainMultipliers[terrain] && terrainMultipliers[terrain][itemId]) {
      return terrainMultipliers[terrain][itemId];
    }

    // Check item's terrain affinity
    const item = this.getItem(itemId);
    if (item && item.terrainAffinity && item.terrainAffinity[terrain]) {
      return item.terrainAffinity[terrain];
    }

    return 1.0;
  }

  // Fallback: Original location generation (preserved for compatibility)
  generateLocations() {
    let seedRng = this.game.seed;
    function seededRandom() {
      seedRng = (seedRng * 9301 + 49297) % 233280;
      return seedRng / 233280;
    }

    const gridWidth = this.game.rules.grid.width;
    const gridHeight = this.game.rules.grid.height;
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);

    this.game.locationGrid = Array(gridHeight)
      .fill()
      .map(() => Array(gridWidth).fill(null));

    const min = this.game.rules.worldGeneration.minLocations;
    const max = this.game.rules.worldGeneration.maxLocations;
    const locationCount = Math.floor(seededRandom() * (max - min + 1)) + min;
    const templates = this.game.gameData.locationTemplates;

    this.game.locations = [{ ...templates[0] }];
    this.game.locationGrid[centerY][centerX] = 0;

    const shuffled = templates.slice(1).sort(() => seededRandom() - 0.5);
    const selectedTemplates = shuffled.slice(0, locationCount - 1);

    selectedTemplates.forEach((template, index) => {
      const locationIndex = index + 1;
      const location = { ...template };
      let minDist, maxDist;
      
      switch (template.distanceTier) {
        case 1: minDist = 1; maxDist = 2; break;
        case 2: minDist = 3; maxDist = 4; break;
        case 3: minDist = 5; maxDist = 7; break;
        case 4: minDist = 8; maxDist = 10; break;
        default: minDist = 2; maxDist = 4; break;
      }

      const validPositions = [];
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (this.game.locationGrid[y][x] === null) {
            const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
            if (dist >= minDist && dist <= maxDist) {
              validPositions.push({ x, y });
            }
          }
        }
      }

      if (validPositions.length > 0) {
        const pos = validPositions[Math.floor(seededRandom() * validPositions.length)];
        this.game.locationGrid[pos.y][pos.x] = locationIndex;
        this.game.locations.push(location);
      } else {
        for (let y = 0; y < gridHeight; y++) {
          for (let x = 0; x < gridWidth; x++) {
            if (this.game.locationGrid[y][x] === null) {
              this.game.locationGrid[y][x] = locationIndex;
              this.game.locations.push(location);
              break;
            }
          }
          if (this.game.locations.length > locationIndex) break;
        }
      }
    });

    // Build travel network
    this.initializeConnections();
    for (let i = 0; i < this.game.locations.length; i++) {
      for (let j = i + 1; j < this.game.locations.length; j++) {
        const dist = this.getGridDistance(i, j);
        if (dist <= 3) {
          this.game.connections[i].push(j);
          this.game.connections[j].push(i);
        }
      }
    }
    this.ensureWorldConnected();
  }

  initializeConnections() {
    this.game.connections = {};
    for (let i = 0; i < this.game.locations.length; i++) {
      this.game.connections[i] = [];
    }
  }

  ensureWorldConnected() {
    const visited = new Set();
    const queue = [0];
    visited.add(0);

    while (queue.length > 0) {
      const current = queue.shift();
      const neighbors = this.game.connections[current];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Connect isolated locations
    for (let i = 1; i < this.game.locations.length; i++) {
      if (!visited.has(i)) {
        let closest = null;
        let minDist = Infinity;
        for (let j = 0; j < this.game.locations.length; j++) {
          if (visited.has(j)) {
            const dist = this.getGridDistance(i, j);
            if (dist < minDist) {
              minDist = dist;
              closest = j;
            }
          }
        }
        if (closest !== null) {
          this.game.connections[i].push(closest);
          this.game.connections[closest].push(i);
        }
      }
    }
  }

  getGridDistance(locIndexA, locIndexB) {
    const posA = this.findLocationPosition(locIndexA);
    const posB = this.findLocationPosition(locIndexB);
    if (!posA || !posB) return Infinity;
    return Math.abs(posA.x - posB.x) + Math.abs(posA.y - posB.y);
  }

  findLocationPosition(locationIndex) {
    if (this.game.locations[locationIndex] && 
        typeof this.game.locations[locationIndex].x === 'number') {
      return { 
        x: this.game.locations[locationIndex].x, 
        y: this.game.locations[locationIndex].y 
      };
    }

    // Fallback to grid search
    for (let y = 0; y < this.game.locationGrid.length; y++) {
      for (let x = 0; x < this.game.locationGrid[y].length; x++) {
        if (this.game.locationGrid[y][x] === locationIndex) {
          return { x, y };
        }
      }
    }
    return null;
  }

  // Getter methods for controlled access
  getPrice(itemId) {
    return this.game.prices[itemId];
  }

  getStock(itemId) {
    return this.game.stock[itemId] || 0;
  }

  getSaturation(key) {
    return this.game.saturation[key] || 0;
  }

  getInventorySpace() {
    return this.game.rules.gameplay.inventoryLimit - this.game.inventory.length;
  }

  getItem(itemId) {
    return this.game.items.find((i) => i.id === itemId);
  }

  getLocation(index) {
    return this.game.locations[index];
  }

  getCurrentLocation() {
    return this.game.locations[this.game.location];
  }

  getInventoryCount(itemId) {
    return this.game.inventory.filter((item) => item.id === itemId).length;
  }

  getGold() {
    return this.game.gold;
  }

  // Quest methods
  setQuest(quest) {
    this.game.currentQuest = quest;
  }

  updateQuestDelivered(amount) {
    if (this.game.currentQuest) {
      this.game.currentQuest.delivered += amount;
    }
  }

  completeQuest() {
    this.game.currentQuest = null;
  }

  // Get world name for display
  getWorldName() {
    return this.game.worldName || "Unnamed Realm";
  }
}