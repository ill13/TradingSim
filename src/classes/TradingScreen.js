// src/ui/TradingScreen.js
export class TradingScreen {
  constructor(gameState, container) {
    this.gameState = gameState;
    this.container = container;

    // Cache DOM elements
    this.elements = {
      items: container.querySelector("#items"),
      questHint: container.querySelector("#questHint"),
      insightText: container.querySelector("#insightText"),
      headerEmoji: document.querySelector(".header-left > div"),
      subtitle: document.querySelector(".location-subtitle"),
      location: document.getElementById("location"),
      day: document.getElementById("day"),
      gold: document.getElementById("gold"),
      inventoryCount: document.getElementById("inventoryCount"),
    };

    // Bind methods for event listeners
    this.render = this.render.bind(this);
  }

  // === LIFECYCLE METHODS ===
  show() {
    this.container.classList.remove("hidden");
    this.render();
  }

  hide() {
    this.container.classList.add("hidden");
  }

  // === MAIN RENDER METHOD ===
  render() {
    const currentLocation = this.gameState.getCurrentLocation();
    const maxDay = this.gameState.game.rules.gameplay.maxDays;
    const isSeasonOver = this.gameState.game.day >= maxDay;
    const canTravel = canReachAnyLocation();
    const isGameOver = isSeasonOver || !canTravel;

    // Update header
    this.elements.headerEmoji.textContent = currentLocation.emoji;
    this.elements.subtitle.textContent = currentLocation.flavorText;
    this.elements.location.textContent = currentLocation.name;

    // Update stats
    this.elements.day.textContent = this.gameState.game.day;
    this.elements.gold.textContent = this.gameState.getGold();
    this.elements.inventoryCount.textContent = `${this.gameState.game.inventory.length}/${this.gameState.game.rules.gameplay.inventoryLimit}`;

    // Update banners
    this.renderBanner(isGameOver);

    // Update market insight
    this.renderMarketInsight(currentLocation);

    // Update item grid
    this.renderItemList(isGameOver);
  }

  renderBanner(isGameOver) {
    if (isGameOver) {
      this.renderGameOverBanner();
    } else if (this.gameState.game.currentQuest) {
      this.renderQuestBanner();
    } else {
      this.renderIdleBanner();
    }
  }

  renderGameOverBanner() {
    this.elements.questHint.innerHTML = `
      <div class="quest-banner">
        <div class="quest-icon">🍂</div>
        <div class="quest-text">
          <div class="quest-title">Season Complete</div>
          <div class="quest-progress">No more journeys this season. Sell your goods and begin anew.</div>
        </div>
        <button class="btn btn-quest" onclick="resetGame()">
          Begin New Season
        </button>
      </div>
    `;
  }

  renderQuestBanner() {
    const quest = this.gameState.game.currentQuest;
    const questItem = this.gameState.getItem(quest.itemId);
    const canDeliver = QuestLogic.updateNewsUI();
    const owned = this.gameState.getInventoryCount(quest.itemId);
    const needed = quest.quantity - quest.delivered;
    const buttonText = canDeliver ? "✅ Deliver" : "❌ Need More";
    const buttonDisabled = !canDeliver;

    this.elements.questHint.innerHTML = `
      <div class="quest-banner">
        <div class="quest-icon">📋</div>
        <div class="quest-text">
          <div class="quest-title">Deliver ${questItem.name} to ${quest.targetLocationName}</div>
          <div class="quest-progress">You have ${owned}, need ${needed}</div>
        </div>
        <button class="btn btn-quest" onclick="deliverQuest()" ${buttonDisabled ? "disabled" : ""}>
          ${buttonText}
        </button>
      </div>
    `;
  }

  renderIdleBanner() {
    this.elements.questHint.innerHTML = `
      <div class="quest-banner">
        <div class="quest-icon">💡</div>
        <div class="quest-text">
          <div class="quest-title">No Active Quest</div>
          <div class="quest-progress">Keep trading — a new quest will appear soon.</div>
        </div>
      </div>
    `;
  }

  renderMarketInsight(location) {
    const goodDeals = this.gameState.game.items.filter((item) => {
      const multiplier = location.multipliers[item.category] || 1.0;
      return multiplier <= 0.9;
    });

    if (goodDeals.length > 0) {
      const avgDiscount = Math.round(
        (1 - goodDeals.reduce((sum, item) => sum + (location.multipliers[item.category] || 1.0), 0) / goodDeals.length) * 100
      );
      this.elements.insightText.textContent = `Great prices here! (${avgDiscount}% below average)`;
    } else {
      this.elements.insightText.textContent = "Standard market prices";
    }
  }

  renderItemList(isGameOver) {
    this.elements.items.innerHTML = this.gameState.game.items
      .map((item) => {
        const price = MarketLogic.getPrice(item.id, this.gameState.game.location);
        const stock = this.gameState.getStock(item.id);
        const owned = this.gameState.getInventoryCount(item.id);
        const maxBuy = isGameOver ? 0 : MarketLogic.getMaxBuyQuantity(item.id);
        const maxSell = MarketLogic.getMaxSellQuantity(item.id);
        const dealQuality = MarketLogic.getDealQuality(item.id);
        const avgPurchasePrice = this.gameState.getAveragePurchasePrice(item.id);

        const dealClasses = { great: "deal-great", good: "deal-good", fair: "deal-fair", poor: "deal-poor" };
        const rowClasses = ["item-row"];
        if (dealQuality === "great" || dealQuality === "good") rowClasses.push("good-deal");
        else if (dealQuality === "poor") rowClasses.push("bad-deal");
        if (stock === 0) rowClasses.push("no-stock");

        const displayPrice = stock === 0 ? "--" : `${price}g${avgPurchasePrice !== null ? ` (${avgPurchasePrice}g avg)` : ""}`;

        return `
          <div class="${rowClasses.join(" ")}">
            <div class="item-visual">
              <div class="item-icon">${item.emoji}</div>
              <div class="deal-indicator ${dealClasses[dealQuality]}">${dealQuality === 'great' ? 'Great!' : dealQuality === 'good' ? 'Good' : dealQuality === 'fair' ? 'Fair' : 'Poor'}</div>
            </div>
            <div class="item-info">
              <div class="item-header">
                ${item.name}<span class="item-price">${displayPrice}</span>
              </div>
              <div class="item-meta">Available: ${stock} | You own: <span class="owned-count">${owned}</span>
                ${this.gameState.game.currentQuest && this.gameState.game.currentQuest.itemId === item.id ? "<br>Perfect for your quest!" : ""}
                ${stock <= 2 && stock > 0 ? "<br>Limited stock - act fast!" : ""}
                ${dealQuality === "poor" ? "<br>Overpriced here - try elsewhere" : ""}
                ${dealQuality === "great" ? "<br>Excellent value!" : ""}
              </div>
            </div>
            <div class="buy-controls">
              <div class="quantity-action-row">
                <button class="quantity-btn" onclick="changeQuantity('${item.id}', 'buy', -1)" ${maxBuy === 0 ? "disabled" : ""}>−</button>
                <button class="btn btn-buy action-button" onclick="executeTrade('${item.id}', 'buy')" ${maxBuy === 0 ? "disabled" : ""} id="buy-button-${item.id}">
                  BUY <span id="buy-${item.id}">1</span>
                </button>
                <button class="quantity-btn" onclick="changeQuantity('${item.id}', 'sell', 1)" ${maxBuy === 0 ? "disabled" : ""}>+</button>
              </div>
              <button class="btn btn-buy action-button" onclick="MarketActions.quickBuyAll('${item.id}')" ${maxBuy === 0 ? "disabled" : ""}>
                Buy All (${maxBuy})
              </button>
            </div>
            <div class="sell-controls">
              <div class="quantity-action-row">
                <button class="quantity-btn" onclick="changeQuantity('${item.id}', 'sell', -1)" ${maxSell === 0 ? "disabled" : ""}>−</button>
                <button class="btn btn-sell action-button" onclick="executeTrade('${item.id}', 'sell')" ${maxSell === 0 ? "disabled" : ""} id="sell-button-${item.id}">
                  SELL <span id="sell-${item.id}">1</span>
                </button>
                <button class="quantity-btn" onclick="changeQuantity('${item.id}', 'sell', 1)" ${maxSell === 0 ? "disabled" : ""}>+</button>
              </div>
              <button class="btn btn-sell action-button" onclick="MarketActions.quickSellAll('${item.id}')" ${maxSell === 0 ? "disabled" : ""}>
                Sell All (${maxSell})
              </button>
            </div>
          </div>`;
      })
      .join("");
  }
}