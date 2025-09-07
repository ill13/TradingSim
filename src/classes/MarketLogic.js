// src/classes/MarketLogic.js - Enhanced with Terrain Integration
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
      // Base stock generation
      let baseStock = Math.floor(Math.random() * STOCK_RANGE) + MIN_STOCK;
      
      // Modify stock based on terrain suitability
      const currentLocation = this.gameState.getCurrentLocation();
      if (currentLocation && currentLocation.terrain) {
        const terrainMultiplier = this.gameState.getTerrainPriceMultiplier(item.id, this.gameState.game.location);
        
        // More abundant in suitable terrain = higher stock
        if (terrainMultiplier < 0.9) {
          baseStock = Math.floor(baseStock * 1.3); // 30% more stock where cheap
        } else if (terrainMultiplier > 1.2) {
          baseStock = Math.floor(baseStock * 0.7); // 30% less stock where expensive
        }
      }
      
      stock[item.id] = Math.max(1, baseStock); // Always at least 1
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

    // ✅ NEW: Enhanced price calculation with terrain and location multipliers
    let finalMultiplier = DEFAULT_MULTIPLIER;

    // 1. Location-based multipliers (existing system)
    if (location && location.multipliers && location.multipliers[item.category]) {
      finalMultiplier *= location.multipliers[item.category];
    }

    // 2. Terrain-based multipliers (new system)
    const terrainMultiplier = this.gameState.getTerrainPriceMultiplier(itemId, locationId);
    finalMultiplier *= terrainMultiplier;

    // 3. Market saturation effects (existing system)
    const saturationKey = `${locationId}-${itemId}`;
    const saturationLevel = this.gameState.getSaturation(saturationKey);
    let marketAdjustment = 1.0;
    
    if (saturationLevel >= SATURATION_THRESHOLD) {
      const excessSaturation = saturationLevel - SATURATION_THRESHOLD;
      marketAdjustment = 1.0 - SATURATION_PENALTY_RATE * (1 + excessSaturation * 0.2);
      marketAdjustment = Math.max(0.6, marketAdjustment);
    }

    const finalPrice = basePrice * finalMultiplier * marketAdjustment;
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
    if (price <= 0) return 0;
    
    const affordable = Math.floor(this.gameState.getGold() / price);
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
    
    // Calculate combined multiplier (location + terrain)
    let combinedMultiplier = 1.0;
    
    // Location multiplier
    if (location && location.multipliers && location.multipliers[item.category]) {
      combinedMultiplier *= location.multipliers[item.category];
    }
    
    // Terrain multiplier
    const terrainMultiplier = this.gameState.getTerrainPriceMultiplier(itemId, this.gameState.game.location);
    combinedMultiplier *= terrainMultiplier;
    
    // Enhanced deal quality assessment
    if (combinedMultiplier <= 0.75) return "great";  // 25%+ discount
    if (combinedMultiplier <= 0.90) return "good";   // 10%+ discount
    if (combinedMultiplier >= 1.35) return "poor";   // 35%+ markup
    return "fair";
  }

  // ✅ NEW: Get terrain-based market insights
  getMarketInsights(locationId) {
    const location = this.gameState.getLocation(locationId);
    const insights = [];
    
    if (!location || !location.terrain) {
      return ["Standard market conditions"];
    }

    const terrain = location.terrain;
    const terrainMultipliers = this.gameState.game.gameData.terrainMultipliers;
    
    if (terrainMultipliers && terrainMultipliers[terrain]) {
      const goodDeals = [];
      const badDeals = [];
      
      Object.entries(terrainMultipliers[terrain]).forEach(([itemId, multiplier]) => {
        const item = this.gameState.getItem(itemId);
        if (!item) return;
        
        if (multiplier <= 0.8) {
          goodDeals.push(item.name);
        } else if (multiplier >= 1.3) {
          badDeals.push(item.name);
        }
      });
      
      if (goodDeals.length > 0) {
        insights.push(`Excellent ${goodDeals.join(', ')} prices here due to local ${terrain} abundance`);
      }
      
      if (badDeals.length > 0) {
        insights.push(`${badDeals.join(', ')} are scarce in this ${terrain} region`);
      }
    }
    
    // Fallback insight
    if (insights.length === 0) {
      const terrainLabels = {
        water: "riverside location offers fresh fishing opportunities",
        forest: "woodland setting provides natural resources", 
        meadow: "pastoral setting supports agricultural trade",
        spire: "mountain location specializes in crafted goods",
        barrens: "harsh landscape yields rare and valuable items"
      };
      
      insights.push(`This ${terrainLabels[terrain] || 'unique location offers varied trading opportunities'}`);
    }
    
    return insights;
  }

  // ✅ NEW: Calculate terrain bonus for news display
  getTerrainBonus(itemId, locationId) {
    const terrainMultiplier = this.gameState.getTerrainPriceMultiplier(itemId, locationId);
    const location = this.gameState.getLocation(locationId);
    
    if (terrainMultiplier <= 0.8) {
      return `Great ${this.gameState.getItem(itemId).name} prices in this ${location.terrain}!`;
    } else if (terrainMultiplier >= 1.3) {
      return `${this.gameState.getItem(itemId).name} is scarce in this ${location.terrain}`;
    }
    
    return null;
  }
}