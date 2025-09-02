
// Market Actions
export class MarketActions {
    constructor(gameState, this.marketLogic) {
        this.gameState = this.gameState;
        this.marketLogic = this.marketLogic;
    }

  sell(itemId, quantity) {
    const price = this.marketLogic.getPrice(itemId, this.gameState.game.location);
    this.gameState.removeFromInventory(itemId, quantity);
    this.gameState.updateGold(price * quantity);
    const rules = this.gameState.game.rules.pricing.saturation;
    if (quantity >= rules.threshold) {
      const satKey = `${gameState.game.location}-${itemId}`;
      const currentSaturation = this.gameState.getSaturation(satKey);
      const newSaturation = Math.min(rules.maxSaturation, currentSaturation + quantity);
      this.gameState.setSaturation(satKey, newSaturation);
    }
  }
  buy(itemId, quantity) {
    const price = this.marketLogic.getPrice(itemId, this.gameState.game.location);
    const cost = price * quantity;
    this.gameState.updateGold(-cost);
    this.gameState.updateStock(itemId, -quantity);
    this.gameState.addToInventory(itemId, quantity, price);
    const rules = this.gameState.game.rules.pricing.saturation;
    /* //Disable buy sell trick
          if (quantity >= rules.threshold) {
            const satKey = `${gameState.game.location}-${itemId}`;
            const buyingSaturation = quantity * rules.buyingSaturationRate;
            const currentSaturation = this.gameState.getSaturation(satKey);
            const newSaturation = Math.min(rules.maxSaturation, currentSaturation + buyingSaturation);
            this.gameState.setSaturation(satKey, newSaturation);
          }
            //*/
  }

  quickBuyAll(itemId) {
    const max = this.marketLogic.getMaxBuyQuantity(itemId);
    if (max > 0) {
      MarketActions.buy(itemId, max);
      updateUI();
    }
  }

  quickSellAll(itemId) {
    const max = this.marketLogic.getMaxSellQuantity(itemId);
    if (max > 0) {
      MarketActions.sell(itemId, max);
      updateUI();
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
