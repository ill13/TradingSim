// src/Main.js - Enhanced with WFC Integration
import { GameState } from "./classes/GameState.js";
import { MapRenderer } from "./classes/MapRenderer.js";
import { MarketLogic } from "./classes/MarketLogic.js";
import { MarketActions } from "./classes/MarketActions.js";
import { WFCLoader } from "./classes/WFCLoader.js";
import { TemplatePlacer, WaveFunctionCollapse } from "./classes/WFCEmbedded.js";

// Import ParchmentOverlay if available
let ParchmentOverlay = null;
try {
  const parchmentModule = await import('./classes/ParchmentOverlay.js');
  ParchmentOverlay = parchmentModule.ParchmentOverlay;
  window.ParchmentOverlay = ParchmentOverlay; // Make globally available
} catch (error) {
  console.log("ParchmentOverlay not available, using fallback rendering");
}

// Game state object
const game = {
  day: 1,
  gold: 100,
  location: 0,
  inventory: [],
  prices: {},
  stock: {},
  saturation: {},
  locations: [],
  locationGrid: [],
  items: [],
  quests: [],
  achievements: [],
  currentQuest: null,
  unlockedAchievements: new Set(),
  seed: Date.now() % 10000,
  rules: null,
  gameData: null,
  worldName: "Unnamed Realm",
  isGeneratingWorld: false
};

// Create instances
const gameState = new GameState(game);
const marketLogic = new MarketLogic(gameState);
const marketActions = new MarketActions(gameState, marketLogic);

// Grid system utilities (preserved for compatibility)
class GridSystem {
  static findLocationPosition(locationIndex) {
    const location = gameState.game.locations[locationIndex];
    if (location && typeof location.x === 'number') {
      return { x: location.x, y: location.y };
    }

    // Fallback to grid search
    for (let y = 0; y < gameState.game.locationGrid.length; y++) {
      for (let x = 0; x < gameState.game.locationGrid[y].length; x++) {
        if (gameState.game.locationGrid[y][x] === locationIndex) {
          return { x, y };
        }
      }
    }
    return null;
  }

  static areAdjacent(locIndexA, locIndexB) {
    const posA = this.findLocationPosition(locIndexA);
    const posB = this.findLocationPosition(locIndexB);
    if (!posA || !posB) return false;
    const dx = Math.abs(posA.x - posB.x);
    const dy = Math.abs(posA.y - posB.y);
    return dx <= 1 && dy <= 1 && dx + dy > 0;
  }

  static getGridDistance(locIndexA, locIndexB) {
    return gameState.getGridDistance(locIndexA, locIndexB);
  }

  static getTravelTime(fromIndex, toIndex) {
    const path = this.findPath(fromIndex, toIndex);
    if (path.length <= 1) return Infinity;

    let totalDays = 0;
    for (let i = 1; i < path.length; i++) {
      totalDays += this.getGridDistance(path[i - 1], path[i]);
    }
    return totalDays;
  }

  static findPath(fromIndex, toIndex) {
    if (fromIndex === toIndex) return [fromIndex];
    
    const openSet = [{ location: fromIndex, g: 0, f: 0, parent: null }];
    const closedSet = new Set();
    
    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      
      if (current.location === toIndex) {
        const path = [];
        let node = current;
        while (node) {
          path.unshift(node.location);
          node = node.parent;
        }
        return path;
      }
      
      closedSet.add(current.location);
      const neighbors = gameState.game.connections[current.location] || [];
      
      for (const neighborIndex of neighbors) {
        if (closedSet.has(neighborIndex)) continue;
        
        const g = current.g + 1;
        const h = this.getGridDistance(neighborIndex, toIndex);
        const f = g + h;
        
        const existing = openSet.find((n) => n.location === neighborIndex);
        if (!existing || g < existing.g) {
          openSet.push({
            location: neighborIndex,
            g,
            f,
            parent: current,
          });
        }
      }
    }
    return [];
  }
}

// Quest system (preserved)
class QuestLogic {
  static generateQuest(currentLocationIndex, baseSeed, currentDay) {
    let seedRng = baseSeed + 1;
    function seededRandom() {
      seedRng = (seedRng * 9301 + 49297) % 233280;
      return seedRng / 233280;
    }
    
    const item = gameState.game.items[Math.floor(seededRandom() * gameState.game.items.length)];
    const validTargets = [];
    
    gameState.game.locations.forEach((location, index) => {
      if (index === currentLocationIndex) return;
      const multiplier = location.multipliers[item.category] || 1.0;
      if (multiplier >= 1.2) {
        validTargets.push(location);
      }
    });
    
    if (validTargets.length === 0) {
      validTargets.push(...gameState.game.locations.filter((_, i) => i !== currentLocationIndex));
    }
    
    const targetLocation = validTargets[Math.floor(seededRandom() * validTargets.length)];
    let quantity;
    
    switch (item.category) {
      case "basic": quantity = Math.floor(seededRandom() * 3) + 3; break;
      case "quality": quantity = Math.floor(seededRandom() * 3) + 2; break;
      case "premium": quantity = Math.floor(seededRandom() * 2) + 1; break;
      default: quantity = 3;
    }
    
    const reward = item.basePrice * quantity * 1.5;
    
    return {
      itemId: item.id,
      targetLocationName: targetLocation.name,
      quantity: quantity,
      delivered: 0,
      reward: Math.round(reward),
    };
  }

  static updateNewsUI() {
    if (!gameState.game.currentQuest) return false;
    const currentLocationName = gameState.getCurrentLocation().name;
    const targetMatch = currentLocationName === gameState.game.currentQuest.targetLocationName;
    const questItemCount = gameState.getInventoryCount(gameState.game.currentQuest.itemId);
    const hasEnoughItems = questItemCount >= gameState.game.currentQuest.quantity - gameState.game.currentQuest.delivered;
    return targetMatch && hasEnoughItems;
  }

  static deliverQuest() {
    if (!QuestLogic.updateNewsUI()) return;
    const quest = gameState.game.currentQuest;
    const questItemCount = gameState.getInventoryCount(quest.itemId);
    const deliverAmount = Math.min(questItemCount, quest.quantity - quest.delivered);
    
    gameState.removeFromInventory(quest.itemId, deliverAmount);
    gameState.updateQuestDelivered(deliverAmount);
    
    if (quest.delivered >= quest.quantity) {
      gameState.updateGold(quest.reward);
      gameState.completeQuest();
      const newQuest = QuestLogic.generateQuest(gameState.game.location, gameState.game.seed, gameState.game.day);
      gameState.setQuest(newQuest);
    }
    updateUI();
  }
}

// Core game functions (enhanced)
function travel(locationIndex) {
  const travelTime = GridSystem.getTravelTime(gameState.game.location, locationIndex);
  if (travelTime === Infinity) return;

  const arrivalDay = gameState.game.day + travelTime;
  const maxDay = gameState.game.rules.gameplay.maxDays;

  if (arrivalDay > maxDay) {
    if (locationIndex === gameState.game.location) {
      enterLocation(locationIndex);
    }
    return;
  }

  gameState.setLocation(locationIndex);
  gameState.updateDay(travelTime);
  marketActions.updatePrices();
  marketActions.updateStock();
  gameState.decaySaturation();

  updateUI();
  
  if (gameState.game.day >= gameState.game.rules.gameplay.maxDays || !canReachAnyLocation()) {
    endGame();
  }
}

function enterLocation(locationIndex) {
  updateUI();
  showTrading();
}

function showMap() {
  document.getElementById("mapScreen").classList.remove("hidden");
  document.getElementById("tradingScreen").classList.add("hidden");

  if (gameState.game.day >= gameState.game.rules.gameplay.maxDays || !canReachAnyLocation()) {
    setTimeout(endGame, 600);
  }
  updateUI();
}

function showTrading() {
  document.getElementById("mapScreen").classList.add("hidden");
  document.getElementById("tradingScreen").classList.remove("hidden");
  updateUI();
}

// ✅ NEW: Show world generation progress
function showWorldGeneration(message, progress) {
  const mapScreen = document.getElementById("mapScreen");
  let progressOverlay = document.getElementById("worldGenProgress");
  
  if (!progressOverlay) {
    progressOverlay = document.createElement("div");
    progressOverlay.id = "worldGenProgress";
    progressOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(58, 40, 24, 0.95);
      padding: 32px;
      border-radius: 8px;
      border: 2px solid #d4af37;
      color: #e8dcc5;
      text-align: center;
      z-index: 10;
      min-width: 300px;
    `;
    mapScreen.appendChild(progressOverlay);
  }
  
  progressOverlay.innerHTML = `
    <div style="font-size: 1.2rem; margin-bottom: 16px;">🗺️ Creating World</div>
    <div style="margin-bottom: 16px;">${message}</div>
    <div style="background: #2c2418; height: 20px; border-radius: 10px; overflow: hidden;">
      <div style="background: #d4af37; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
    </div>
    <div style="margin-top: 8px; font-size: 0.9rem; opacity: 0.8;">${progress}%</div>
  `;
}

function hideWorldGeneration() {
  const progressOverlay = document.getElementById("worldGenProgress");
  if (progressOverlay) {
    progressOverlay.remove();
  }
}

function updateUI() {
  document.getElementById("day").textContent = gameState.game.day;
  document.getElementById("gold").textContent = gameState.getGold();
  document.getElementById("location").textContent = gameState.getCurrentLocation().name;
  document.getElementById("inventoryCount").textContent = `${gameState.game.inventory.length}/${gameState.game.rules.gameplay.inventoryLimit}`;
  
  updateInventoryUI();
  updateNewsUI();
  updateTradingUI();

  if (window.mapRenderer) {
    mapRenderer.draw();
  }
}

function updateInventoryUI() {
  const inventory = document.getElementById("inventory");
  const items = {};
  gameState.game.inventory.forEach((item) => {
    items[item.id] = (items[item.id] || 0) + 1;
  });

  inventory.innerHTML = Object.keys(items).length === 0
    ? "<div>Empty</div>"
    : Object.entries(items)
        .map(([id, count], index) => {
          const item = gameState.getItem(id);
          return `<div class="inventory-item">
                    <span class="inventory-item-icon" style="--index: ${index};">${item.emoji}</span>
                    <span class="inventory-item-text">${item.name}</span>
                    <span class="inventory-item-count">x${count}</span>
                  </div>`;
        })
        .join("");
}

function updateNewsUI() {
  const newsContainer = document.getElementById("news");
  const items = [];
  
  if (gameState.game.currentQuest) {
    const questItem = gameState.getItem(gameState.game.currentQuest.itemId);
    items.push(`<div class="quest-item">
                  <div class="quest-title">Deliver ${questItem.name} to ${gameState.game.currentQuest.targetLocationName}</div>
                  <div class="quest-progress">Progress: ${gameState.game.currentQuest.delivered}/${gameState.game.currentQuest.quantity} ${questItem.name} delivered | Reward: ${gameState.game.currentQuest.reward} gold</div>
                </div>`);
  }
  
  // ✅ NEW: Enhanced news with terrain insights
  const current = gameState.getCurrentLocation();
  const insights = marketLogic.getMarketInsights(gameState.game.location);
  
  insights.forEach(insight => {
    items.push(`<div class="news-item market-opportunity">${insight}</div>`);
  });
  
  // Add terrain-specific bonuses
  gameState.game.items.forEach((item) => {
    const terrainBonus = marketLogic.getTerrainBonus(item.id, gameState.game.location);
    if (terrainBonus) {
      items.push(`<div class="news-item market-opportunity">${item.emoji} ${terrainBonus}</div>`);
    }
  });
  
  // Fill with generic news
  const genericNews = gameState.game.gameData.genericNews;
  while (items.length < 6) {
    items.push(`<div class="news-item">${genericNews[Math.floor(Math.random() * genericNews.length)]}</div>`);
  }
  
  newsContainer.innerHTML = items.slice(0, 6).join("");
}

function updateTradingUI() {
  const items = document.getElementById("items");
  const questHint = document.getElementById("questHint");
  const currentLocation = gameState.getCurrentLocation();
  const headerEmoji = document.querySelector(".header-left > div");
  const maxDay = gameState.game.rules.gameplay.maxDays;
  const isSeasonOver = gameState.game.day >= maxDay;
  const canTravel = canReachAnyLocation();
  const isGameOver = isSeasonOver || !canTravel;
  const canBuyItems = canTravel && !isSeasonOver;

  // Update header
  headerEmoji.textContent = currentLocation.emoji;
  document.querySelector(".location-subtitle").textContent = currentLocation.flavorText || 
    `A ${currentLocation.terrain || 'mysterious'} settlement`;

  // ✅ Enhanced banner with world name
  if (isGameOver) {
    questHint.innerHTML = `
      <div class="quest-banner">
        <div class="quest-icon">🍂</div>
        <div class="quest-text">
          <div class="quest-title">Season Complete in ${gameState.getWorldName()}</div>
          <div class="quest-progress">No more journeys this season. Sell your goods and begin anew.</div>
        </div>
        <button class="btn btn-quest" onclick="resetGame()">
          Begin New Season
        </button>
      </div>
    `;
  } else if (gameState.game.currentQuest) {
    const questItem = gameState.getItem(gameState.game.currentQuest.itemId);
    const canDeliver = QuestLogic.updateNewsUI();
    const owned = gameState.getInventoryCount(gameState.game.currentQuest.itemId);
    const needed = gameState.game.currentQuest.quantity - gameState.game.currentQuest.delivered;
    const buttonText = canDeliver ? "✅ Deliver" : "⏸ Need More";
    const buttonDisabled = !canDeliver;

    questHint.innerHTML = `
      <div class="quest-banner">
        <div class="quest-icon">📋</div>
        <div class="quest-text">
          <div class="quest-title">Deliver ${questItem.name} to ${gameState.game.currentQuest.targetLocationName}</div>
          <div class="quest-progress">You have ${owned}, need ${needed}</div>
        </div>
        <button class="btn btn-quest" onclick="deliverQuest()" ${buttonDisabled ? "disabled" : ""}>
          ${buttonText}
        </button>
      </div>
    `;
  } else {
    questHint.innerHTML = `
      <div class="quest-banner">
        <div class="quest-icon">💡</div>
        <div class="quest-text">
          <div class="quest-title">No Active Quest in ${gameState.getWorldName()}</div>
          <div class="quest-progress">Keep trading — a new quest will appear soon.</div>
        </div>
      </div>
    `;
  }

  // Market insight with terrain information
  const insightText = document.getElementById("insightText");
  const terrainInsights = marketLogic.getMarketInsights(gameState.game.location);
  if (terrainInsights.length > 0) {
    insightText.textContent = terrainInsights[0];
  } else {
    insightText.textContent = "Standard market prices";
  }

  // Enhanced item grid
  items.innerHTML = gameState.game.items
    .map((item) => {
      const price = marketLogic.getPrice(item.id, gameState.game.location);
      const stock = gameState.getStock(item.id);
      const owned = gameState.getInventoryCount(item.id);
      const maxBuy = isGameOver ? 0 : marketLogic.getMaxBuyQuantity(item.id);
      const maxSell = marketLogic.getMaxSellQuantity(item.id);
      const dealQuality = marketLogic.getDealQuality(item.id);
      const avgPurchasePrice = gameState.getAveragePurchasePrice(item.id);
      
      // Enhanced deal classes and text
      const dealClasses = { great: "deal-great", good: "deal-good", fair: "deal-fair", poor: "deal-poor" };
      const dealText = { great: "Great!", good: "Good", fair: "Fair", poor: "Poor" };
      
      const rowClasses = ["item-row"];
      if (dealQuality === "great" || dealQuality === "good") rowClasses.push("good-deal");
      else if (dealQuality === "poor") rowClasses.push("bad-deal");
      if (stock === 0) rowClasses.push("no-stock");

      const displayPrice = stock === 0 ? "--" : `${price}g${avgPurchasePrice !== null ? ` (${avgPurchasePrice}g avg)` : ""}`;

      // Enhanced item metadata with terrain info
      let metaInfo = `Available: ${stock} | You own: <span class="owned-count">${owned}</span>`;
      
      // Add terrain bonus info
      const terrainMultiplier = gameState.getTerrainPriceMultiplier(item.id, gameState.game.location);
      const currentTerrain = currentLocation.terrain;
      if (terrainMultiplier <= 0.8 && currentTerrain) {
        metaInfo += `<br>Abundant in this ${currentTerrain}!`;
      } else if (terrainMultiplier >= 1.3 && currentTerrain) {
        metaInfo += `<br>Scarce in this ${currentTerrain}`;
      }
      
      if (gameState.game.currentQuest && gameState.game.currentQuest.itemId === item.id) {
        metaInfo += "<br>Perfect for your quest!";
      }
      
      if (stock <= 2 && stock > 0) {
        metaInfo += "<br>Limited stock - act fast!";
      }

      return `
        <div class="${rowClasses.join(" ")}">
          <div class="item-visual">
            <div class="item-icon">${item.emoji}</div>
            <div class="deal-indicator ${dealClasses[dealQuality]}">${dealText[dealQuality]}</div>
          </div>
          <div class="item-info">
            <div class="item-header">
              ${item.name}<span class="item-price">${displayPrice}</span>
            </div>
            <div class="item-meta">${metaInfo}</div>
          </div>
          <div class="buy-controls">
            <div class="quantity-action-row">
              <button class="quantity-btn" onclick="changeQuantity('${item.id}', 'buy', -1)" ${maxBuy === 0 ? "disabled" : ""}>−</button>
              <button class="btn btn-buy action-button" onclick="executeTrade('${item.id}', 'buy')" ${maxBuy === 0 ? "disabled" : ""} id="buy-button-${item.id}">
                BUY <span id="buy-${item.id}">1</span>
              </button>
              <button class="quantity-btn" onclick="changeQuantity('${item.id}', 'buy', 1)" ${maxBuy === 0 ? "disabled" : ""}>+</button>
            </div>
            <button class="btn btn-buy action-button" onclick="quickBuyAll('${item.id}')" ${maxBuy === 0 ? "disabled" : ""}>
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
            <button class="btn btn-sell action-button" onclick="quickSellAll('${item.id}')" ${maxSell === 0 ? "disabled" : ""}>
              Sell All (${maxSell})
            </button>
          </div>
        </div>`;
    })
    .join("");
}

function changeQuantity(itemId, type, delta) {
    const element = document.getElementById(`${type}-${itemId}`);
    if (!element) {
        console.warn(`Quantity element #${type}-${itemId} not found`);
        return;
    }
    
    let current = parseInt(element.textContent) || 1;
    const max = type === "buy"
        ? marketActions.marketLogic.getMaxBuyQuantity(itemId)
        : marketActions.marketLogic.getMaxSellQuantity(itemId);
    
    const newValue = Math.min(Math.max(current + delta, 1), max);
    element.textContent = newValue;
    
    const button = document.getElementById(`${type}-button-${itemId}`);
    if (button) {
        button.disabled = false;
    }
}

function executeTrade(itemId, type) {
  const quantity = parseInt(document.getElementById(`${type}-${itemId}`).textContent);
  if (type === "buy" && marketLogic.canBuy(itemId, quantity)) {
    marketActions.buy(itemId, quantity);
  } else if (type === "sell" && marketLogic.canSell(itemId, quantity)) {
    marketActions.sell(itemId, quantity);
  }
  updateUI();
}

function canReachAnyLocation() {
  const currentDay = gameState.game.day;
  const maxDay = gameState.game.rules.gameplay.maxDays;
  const currentLocation = gameState.game.location;

  for (let i = 0; i < gameState.game.locations.length; i++) {
    if (i === currentLocation) continue;
    const travelTime = GridSystem.getTravelTime(currentLocation, i);
    if (travelTime === Infinity) continue;
    if (currentDay + travelTime <= maxDay) return true;
  }
  return false;
}

function endGame() {
  const profit = gameState.game.gold - gameState.game.rules.gameplay.startingGold;
  const reason = "The season has ended. The roads grow quiet until next year.";

  const questHint = document.getElementById("questHint");
  questHint.innerHTML = `
    <div class="quest-banner">
      <div class="quest-icon">🍂</div>
      <div class="quest-text">
        <div class="quest-title">Season Complete in ${gameState.getWorldName()}!</div>
        <div class="quest-progress">${reason} Final profit: ${profit} gold</div>
      </div>
      <button class="btn btn-quest" onclick="resetGame()">
        Begin New Season
      </button>
    </div>
  `;
}

// ✅ NEW: Enhanced reset with world generation
async function resetGame() {
  try {
    // Show progress overlay
    showWorldGeneration("Initializing...", 0);
    
    // Reset game state
    gameState.reset();
    
    // Generate new WFC world
    const success = await gameState.generateWFCWorld((message, progress) => {
      showWorldGeneration(message, progress);
    });
    
    if (success) {
      showWorldGeneration("Setting up economy...", 90);
      
      // Initialize map renderer with WFC support
      if (window.mapRenderer && gameState.wfc) {
        await mapRenderer.initializeWFCRender(gameState.wfc);
      }
    }
    
    showWorldGeneration("Finalizing world...", 95);
    
    // Set up economy and quests
    const initialQuest = QuestLogic.generateQuest(gameState.game.location, gameState.game.seed, gameState.game.day);
    gameState.setQuest(initialQuest);
    marketActions.updatePrices();
    marketActions.updateStock();

    hideWorldGeneration();
    
    // Hide game over and show map
    document.getElementById("gameOver").style.display = "none";
    showMap();
    updateUI();
    
    console.log("✅ New season started in", gameState.getWorldName());
    
  } catch (error) {
    console.error("❌ Failed to reset game:", error);
    hideWorldGeneration();
    
    // Fallback to old generation
    gameState.generateLocations();
    const initialQuest = QuestLogic.generateQuest(gameState.game.location, gameState.game.seed, gameState.game.day);
    gameState.setQuest(initialQuest);
    marketActions.updatePrices();
    marketActions.updateStock();
    
    showMap();
    updateUI();
  }
}

async function loadGameData() {
  try {
    const rulesResponse = await fetch("game_rules.json");
    gameState.game.rules = await rulesResponse.json();
    const dataResponse = await fetch("game_data.json");
    gameState.game.gameData = await dataResponse.json();
    gameState.game.items = gameState.game.gameData.items;
    return true;
  } catch (error) {
    console.error("Failed to load game data:", error);
    return false;
  }
}

function fixMapRenderer(ms = 250) {
  setTimeout(() => {
    window.dispatchEvent(new Event("resize"));
    console.log("🎨 MapRenderer: Canvas size fixed with " + ms + " delay");
  }, ms);
}

async function init() {
  try {
    const dataLoaded = await loadGameData();
    if (!dataLoaded) throw new Error("Failed to load game data");
    
    gameState.setGold(gameState.game.rules.gameplay.startingGold);
    
    console.log("🌍 Starting world generation...");
    showWorldGeneration("Creating your world...", 0);
    
    // Generate WFC world
    const success = await gameState.generateWFCWorld((message, progress) => {
      showWorldGeneration(message, progress);
    });
    
    showWorldGeneration("Setting up economy...", 90);
    
    // Set up initial quest and economy
    const initialQuest = QuestLogic.generateQuest(gameState.game.location, gameState.game.seed, gameState.game.day);
    gameState.setQuest(initialQuest);
    marketActions.updatePrices();
    marketActions.updateStock();

    console.log("✅ Game data loaded:", gameState.game.rules);
    console.log("📍 Locations generated:", gameState.game.locations.map(l => l.name));
    console.log("🗺️ World name:", gameState.getWorldName());

    // Initialize map renderer
    window.mapRenderer = new MapRenderer(document.getElementById("canvas"));
    
    if (success && gameState.wfc) {
      await mapRenderer.initializeWFCRender(gameState.wfc);
    }
    
    hideWorldGeneration();
    updateUI();
    
  } catch (error) {
    console.error("Failed to initialize game:", error);
    hideWorldGeneration();
  }
}

// Export functions to window for HTML compatibility
window.gameState = gameState;
window.MapRenderer = MapRenderer;
window.marketActions = marketActions;
window.GridSystem = GridSystem;
window.init = init;
window.updateUI = updateUI;
window.updateInventoryUI = updateInventoryUI;
window.updateNewsUI = updateNewsUI;
window.updateTradingUI = updateTradingUI;
window.showMap = showMap;
window.showTrading = showTrading;
window.travel = travel;
window.enterLocation = enterLocation;
window.deliverQuest = QuestLogic.deliverQuest;
window.executeTrade = executeTrade;
window.changeQuantity = changeQuantity;
window.quickBuyAll = (itemId) => marketActions.quickBuyAll(itemId);
window.quickSellAll = (itemId) => marketActions.quickSellAll(itemId);
window.endGame = endGame;
window.resetGame = resetGame;

// Start the game
await init();
fixMapRenderer(250);