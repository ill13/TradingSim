// GameState wrapper class
export class GameState {
  constructor(gameObj) {
    this.game = gameObj;
    this.game.connections = {}; // ✅ Initialize here
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

  // Inside the GameState class
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
  }

  // Initialize the connections graph
  initializeConnections() {
    this.game.connections = {}; // key: fromIndex, value: array of toIndex
    for (let i = 0; i < this.game.locations.length; i++) {
      this.game.connections[i] = [];
    }
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

  generateLocations() {
    let seedRng = gameState.game.seed;
    function seededRandom() {
      seedRng = (seedRng * 9301 + 49297) % 233280;
      return seedRng / 233280;
    }

    const gridWidth = gameState.game.rules.grid.width;
    const gridHeight = gameState.game.rules.grid.height;
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);

    gameState.game.locationGrid = Array(gridHeight)
      .fill()
      .map(() => Array(gridWidth).fill(null));

    const min = gameState.game.rules.worldGeneration.minLocations;
    const max = gameState.game.rules.worldGeneration.maxLocations;
    const locationCount = Math.floor(seededRandom() * (max - min + 1)) + min;
    const templates = gameState.game.gameData.locationTemplates;

    gameState.game.locations = [{ ...templates[0] }];
    gameState.game.locationGrid[centerY][centerX] = 0;

    const shuffled = templates.slice(1).sort(() => seededRandom() - 0.5);
    const selectedTemplates = shuffled.slice(0, locationCount - 1);

    selectedTemplates.forEach((template, index) => {
      const locationIndex = index + 1;
      const location = { ...template };
      let minDist, maxDist;
      switch (template.distanceTier) {
        case 1:
          minDist = 1;
          maxDist = 2;
          break;
        case 2:
          minDist = 3;
          maxDist = 4;
          break;
        case 3:
          minDist = 5;
          maxDist = 7;
          break;
        case 4:
          minDist = 8;
          maxDist = 10;
          break;
        default:
          minDist = 2;
          maxDist = 4;
          break;
      }

      const validPositions = [];
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          if (gameState.game.locationGrid[y][x] === null) {
            const dist = Math.abs(x - centerX) + Math.abs(y - centerY);
            if (dist >= minDist && dist <= maxDist) {
              validPositions.push({ x, y });
            }
          }
        }
      }

      if (validPositions.length > 0) {
        const pos = validPositions[Math.floor(seededRandom() * validPositions.length)];
        gameState.game.locationGrid[pos.y][pos.x] = locationIndex;
        gameState.game.locations.push(location);
      } else {
        for (let y = 0; y < gridHeight; y++) {
          for (let x = 0; x < gridWidth; x++) {
            if (gameState.game.locationGrid[y][x] === null) {
              gameState.game.locationGrid[y][x] = locationIndex;
              gameState.game.locations.push(location); // Only once!
              break;
            }
          }
          if (gameState.game.locations.length > locationIndex) break;
        }
      }
    });

    // === Build Travel Network ===
    this.initializeConnections();
    for (let i = 0; i < this.game.locations.length; i++) {
      for (let j = i + 1; j < this.game.locations.length; j++) {
        const dist = GridSystem.getGridDistance(i, j); // ✅ Use grid distance
        if (dist <= 3) {
          this.game.connections[i].push(j);
          this.game.connections[j].push(i);
        }
        // After the double loop
        this.ensureWorldConnected();
      }
    }
  }

  ensureWorldConnected() {
    const visited = new Set();
    const queue = [0]; // Start from Commons (index 0)
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

    // If any location is not visited, force a connection
    for (let i = 1; i < this.game.locations.length; i++) {
      if (!visited.has(i)) {
        // Connect it to the nearest reachable node
        let closest = null;
        let minDist = Infinity;
        for (let j = 0; j < this.game.locations.length; j++) {
          if (visited.has(j)) {
            const dist = GridSystem.getGridDistance(i, j);
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
}
