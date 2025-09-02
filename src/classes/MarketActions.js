
// Market Actions
export class MarketActions {
    constructor(gameState, marketLogic) {
        this.gameState = gameState;
        this.marketLogic = marketLogic;
    }

// src\classes\MarketActions.js
sell(itemId, quantity) {
  const price = this.marketLogic.getPrice(itemId, this.gameState.game.location);
  this.gameState.removeFromInventory(itemId, quantity);
  this.gameState.updateGold(price * quantity);
  const rules = this.gameState.game.rules.pricing.saturation;
  if (quantity >= rules.threshold) {
    // ✅ FIXED: Use 'this.gameState', not 'gameState'
    const satKey = `${this.gameState.game.location}-${itemId}`;
    const currentSaturation = this.gameState.getSaturation(satKey);
    const newSaturation = Math.min(rules.maxSaturation, currentSaturation + quantity);
    this.gameState.setSaturation(satKey, newSaturation);
  }
  // Move updateUI outside the if block
 // window.updateUI();
}

buy(itemId, quantity) {
  const price = this.marketLogic.getPrice(itemId, this.gameState.game.location);
  const cost = price * quantity;
  this.gameState.updateGold(-cost);
  this.gameState.updateStock(itemId, -quantity);
  this.gameState.addToInventory(itemId, quantity, price);
  const rules = this.gameState.game.rules.pricing.saturation;
  if (quantity >= rules.threshold) {
    // ✅ FIXED: Use 'this.gameState', not 'gameState'
    const satKey = `${this.gameState.game.location}-${itemId}`;
    const buyingSaturation = quantity * rules.buyingSaturationRate;
    const currentSaturation = this.gameState.getSaturation(satKey);
    const newSaturation = Math.min(rules.maxSaturation, currentSaturation + buyingSaturation);
    this.gameState.setSaturation(satKey, newSaturation);
  }
  // Always call updateUI
// window.updateUI();
}



  quickBuyAll(itemId) {
    const max = this.marketLogic.getMaxBuyQuantity(itemId);
    if (max > 0) {
      this.buy(itemId, max);
     window.updateUI();
    }
  }

  quickSellAll(itemId) {
    const max = this.marketLogic.getMaxSellQuantity(itemId);
    if (max > 0) {
      this.sell(itemId, max);
      window.updateUI();
    }
  }

  updatePrices() {
    const prices = this.marketLogic.generatePrices();
    this.gameState.setPrices(prices);
  }


  updateStock() {
    const stock = this.marketLogic.generateStock();
    Object.entries(stock).forEach(([itemId, amount]) => {
      this.gameState.setStock(itemId, amount);
    });
  }
}
