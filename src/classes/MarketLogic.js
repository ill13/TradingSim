// Market Logic
export class MarketLogic {
    constructor(gameState) {
        this.gameState = gameState;
    }

  generatePrices() {
    const rules = this.gameState.game.rules.pricing;
    const SEASONAL_MIN = rules.seasonal.min;
    const SEASONAL_RANGE = rules.seasonal.range;
    const DAILY_MIN = rules.daily.min;
    const DAILY_RANGE = rules.daily.range;
    const prices = {};
    this.gameState.game.items.forEach((item) => {
      const base = item.basePrice;
      const seasonal = SEASONAL_MIN + Math.random() * SEASONAL_RANGE;
      const daily = DAILY_MIN + Math.random() * DAILY_RANGE;
      prices[item.id] = Math.round(base * seasonal * daily);
    });
    return prices;
  }
  generateStock() {
    const rules = this.gameState.game.rules.stock;
    const MIN_STOCK = rules.minStock;
    const STOCK_RANGE = rules.stockRange;
    const stock = {};
    this.gameState.game.items.forEach((item) => {
      stock[item.id] = Math.floor(Math.random() * STOCK_RANGE) + MIN_STOCK;
    });
    return stock;
  }
  getPrice(itemId, locationId) {
    const rules = this.gameState.game.rules.pricing.saturation;
    const SATURATION_THRESHOLD = rules.threshold;
    const SATURATION_PENALTY_RATE = rules.penaltyRate;
    const DEFAULT_MULTIPLIER = 1;
    const item = this.gameState.getItem(itemId);
    const location = this.gameState.getLocation(locationId);
    const basePrice = this.gameState.getPrice(itemId);
    const locationMultiplier = location.multipliers[item.category] || DEFAULT_MULTIPLIER;
    const saturationKey = `${locationId}-${itemId}`;
    const saturationLevel = this.gameState.getSaturation(saturationKey);
    let marketAdjustment = 1.0;
    if (saturationLevel >= SATURATION_THRESHOLD) {
      const excessSaturation = saturationLevel - SATURATION_THRESHOLD;
      marketAdjustment = 1.0 - SATURATION_PENALTY_RATE * (1 + excessSaturation * 0.2);
      marketAdjustment = Math.max(0.6, marketAdjustment);
    }
    const finalPrice = basePrice * locationMultiplier * marketAdjustment;
    return Math.round(finalPrice);
  }
  canBuy(itemId, quantity) {
    const price = this.getPrice(itemId, this.gameState.game.location);
    const cost = price * quantity;
    const available = this.gameState.getStock(itemId);
    const space = this.gameState.getInventorySpace();
    return cost <= this.gameState.getGold() && quantity <= available && quantity <= space;
  }
  canSell(itemId, quantity) {
    const owned = this.gameState.getInventoryCount(itemId);
    return quantity <= owned;
  }
  getMaxBuyQuantity(itemId) {
    const price = this.getPrice(itemId, this.gameState.game.location);
    const affordable = Math.floor(gameState.getGold() / price);
    const available = this.gameState.getStock(itemId);
    const space = this.gameState.getInventorySpace();
    return Math.min(affordable, available, space);
  }
  getMaxSellQuantity(itemId) {
    return this.gameState.getInventoryCount(itemId);
  }
  getDealQuality(itemId) {
    const item = this.gameState.getItem(itemId);
    const location = this.gameState.getCurrentLocation();
    const multiplier = location.multipliers[item.category] || 1.0;
    if (multiplier <= 0.8) return "great";
    if (multiplier <= 0.9) return "good";
    if (multiplier >= 1.3) return "poor";
    return "fair";
  }
}