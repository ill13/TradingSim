// GameState wrapper class
export class GameState {
  constructor(gameObj) {
    this.game = gameObj;
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
}
