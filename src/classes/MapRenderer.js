// src/classes/MapRenderer.js - Enhanced with WFC Integration
export class MapRenderer {
  constructor(canvas) {
    console.log("Enhanced MapRenderer loading...");
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hoverLocation = null;
    this.parchmentOverlay = null;
    this.useWFCRender = false;

    // Event listeners
    canvas.addEventListener("click", this.handleClick.bind(this));
    canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    canvas.addEventListener("mouseout", () => {
      this.hoverLocation = null;
      this.canvas.title = "";
      this.canvas.style.cursor = "default";
      this.draw();
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      this.updateCanvasSize();
      this.positionLocations();
      this.draw();
    });

    // Defer initial setup
    requestAnimationFrame(() => {
      this.updateCanvasSize();
      this.positionLocations();
      this.draw();
    });
  }

  // ✅ NEW: Initialize WFC rendering
  async initializeWFCRender(wfc) {
    if (!wfc || typeof ParchmentOverlay === 'undefined') {
      console.log("WFC render not available, using fallback");
      this.useWFCRender = false;
      return;
    }

    try {
      // Load WFC classes if needed
      if (!window.ThemeManager) {
        const { WFCLoader } = await import('./WFCLoader.js');
        await WFCLoader.initialize();
      }

      // Create parchment overlay
      const seed = window.MapNamer.stringToSeed(wfc.mapName);
      this.parchmentOverlay = new ParchmentOverlay(wfc.width, wfc.height, 'fantasy', seed);
      this.parchmentOverlay.initFromTheme(window.ThemeManager.current);
      this.parchmentOverlay.setMapData(wfc.grid);

      // Create and render overlay canvas
      const overlayCanvas = this.parchmentOverlay.createCanvas();
      this.parchmentOverlay.render();

      // Position overlay
      const container = this.canvas.parentElement;
      container.style.position = "relative";
      
      // Remove existing overlay
      const existingOverlay = container.querySelector('.wfc-overlay');
      if (existingOverlay) existingOverlay.remove();

      // Add new overlay
      overlayCanvas.classList.add('wfc-overlay');
      overlayCanvas.style.position = "absolute";
      overlayCanvas.style.top = "0";
      overlayCanvas.style.left = "0";
      overlayCanvas.style.pointerEvents = "none";
      overlayCanvas.style.zIndex = "0";
      
      container.appendChild(overlayCanvas);

      this.useWFCRender = true;
      console.log("✅ WFC parchment overlay initialized");
      
    } catch (error) {
      console.error("❌ Failed to initialize WFC render:", error);
      this.useWFCRender = false;
    }
  }

  updateCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Reset current transform before resizing
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Apply scaling
    this.ctx.scale(dpr, dpr);

    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
  }

positionLocations() {
    const margin = 80;
    const w = this.displayWidth - 2 * margin;
    const h = this.displayHeight - 2 * margin;

    gameState.game.locations.forEach((location, i) => {
      // Use WFC positions if available
      if (this.useWFCRender && typeof location.x === 'number' && typeof location.y === 'number') {
        // Convert WFC grid coordinates to canvas coordinates
        const wfc = gameState.wfc;
        const gridSize = wfc ? Math.max(wfc.width, wfc.height) : 8;
        const cellSize = Math.min(w, h) / gridSize;
        
        // Center the grid within the canvas area
        const gridPixelWidth = wfc.width * cellSize;
        const gridPixelHeight = wfc.height * cellSize;
        const offsetX = (w - gridPixelWidth) / 2;
        const offsetY = (h - gridPixelHeight) / 2;
        
        location.canvasX = margin + offsetX + (location.x + 0.5) * cellSize;
        location.canvasY = margin + offsetY + (location.y + 0.5) * cellSize;
        
        console.log(`📍 Located ${location.name} at canvas (${location.canvasX.toFixed(1)}, ${location.canvasY.toFixed(1)}) from grid (${location.x}, ${location.y})`);
        return;
      }

      // Fallback: Use existing positioning logic for non-WFC locations
      const gridPos = this.findLocationPosition(i);
      if (!gridPos) {
        console.warn(`No position found for location ${i}`);
        return;
      }

      const gridWidth = gameState.game.rules.grid.width;
      const gridHeight = gameState.game.rules.grid.height;

      let x = margin + (gridPos.x / (gridWidth - 1)) * w;
      let y = margin + (gridPos.y / (gridHeight - 1)) * h;

      // Apply random offset
      const locationSeed = gameState.game.seed + i * 17;
      const rand1 = ((locationSeed * 9301 + 49297) % 233280) / 233280;
      const rand2 = (((locationSeed + 1) * 9301 + 49297) % 233280) / 233280;
      x += (rand1 - 0.5) * 60;
      y += (rand2 - 0.5) * 60;

      // Store final position
      location.canvasX = Math.max(margin + 50, Math.min(this.displayWidth - margin - 50, x));
      location.canvasY = Math.max(margin + 50, Math.min(this.displayHeight - margin - 50, y));
    });
  }

  // Helper method for fallback positioning
  findLocationPosition(locationIndex) {
    if (gameState.game.locations[locationIndex] && 
        typeof gameState.game.locations[locationIndex].x === 'number') {
      return { 
        x: gameState.game.locations[locationIndex].x, 
        y: gameState.game.locations[locationIndex].y 
      };
    }

    // Search in locationGrid as fallback
    for (let y = 0; y < gameState.game.locationGrid.length; y++) {
      for (let x = 0; x < gameState.game.locationGrid[y].length; x++) {
        if (gameState.game.locationGrid[y][x] === locationIndex) {
          return { x, y };
        }
      }
    }
    return null;
  }
  draw() {
    this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);

    // ✅ NEW: Different rendering based on mode
    if (this.useWFCRender) {
      this.drawWFCMode();
    } else {
      this.drawClassicMode();
    }
  }

  drawWFCMode() {
    // In WFC mode, we only draw minimal overlay since parchment handles terrain
    // Draw location connections subtly
    this.drawConnections(true);
    
    // Draw locations on top of parchment
    gameState.game.locations.forEach((location, i) => {
      this.drawLocation(location, i, true);
    });

    // Draw hover effects
    if (this.hoverLocation !== null && this.hoverLocation !== gameState.game.location) {
      this.drawPathTo(this.hoverLocation);
      const loc = gameState.game.locations[this.hoverLocation];
      const travelTime = GridSystem.getTravelTime(gameState.game.location, this.hoverLocation);
      this.drawTooltip(loc.canvasX + 50, loc.canvasY, `${travelTime} days 🗺️`);
    }
  }

  drawClassicMode() {
    // Classic rendering with roads and terrain colors
    this.drawRoads();
    
    gameState.game.locations.forEach((location, i) => {
      this.drawLocation(location, i, false);
    });

    // Draw hover effects
    if (this.hoverLocation !== null && this.hoverLocation !== gameState.game.location) {
      this.drawPathTo(this.hoverLocation);
      const loc = gameState.game.locations[this.hoverLocation];
      const travelTime = GridSystem.getTravelTime(gameState.game.location, this.hoverLocation);
      this.drawTooltip(loc.canvasX + 50, loc.canvasY, `${travelTime} days 🗺️`);
    }
  }

  drawLocation(location, i, isWFCMode) {
    const isPlayer = i === gameState.game.location;
    const x = location.canvasX || location.x || 0;
    const y = location.canvasY || location.y || 0;
    const radius = 32;

    // Location circle background
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    if (isWFCMode) {
      // Subtle background for WFC mode
      this.ctx.fillStyle = isPlayer ? "rgba(74, 90, 53, 0.8)" : "rgba(45, 45, 32, 0.6)";
    } else {
      // Full background for classic mode
      this.ctx.fillStyle = isPlayer ? "#4a5a35" : "#2d2d20";
    }
    
    this.ctx.fill();
    this.ctx.strokeStyle = isPlayer ? "#ffd700" : "#6a6a45";
    this.ctx.lineWidth = isPlayer ? 3 : 1;
    this.ctx.stroke();

    // Location emoji
    this.ctx.font = "24px Consolas";
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.fillStyle = "#f4e4bc";
    this.ctx.fillText(location.emoji, x, y);

    // Location name
    this.ctx.font = "12px Consolas";
    this.ctx.textBaseline = "top";
    this.ctx.fillText(location.name, x, y + radius + 8);
  }

  drawConnections(subtle = false) {
    this.ctx.strokeStyle = subtle ? "rgba(139, 115, 85, 0.3)" : "#8b7355";
    this.ctx.lineWidth = subtle ? 1 : 1.5;
    this.ctx.setLineDash(subtle ? [3, 3] : [5, 5]);

    gameState.game.locations.forEach((from, i) => {
      const connections = gameState.game.connections[i] || [];
      connections.forEach((j) => {
        if (i >= j) return; // Draw each connection once
        
        const to = gameState.game.locations[j];
        const fromX = from.canvasX || from.x || 0;
        const fromY = from.canvasY || from.y || 0;
        const toX = to.canvasX || to.x || 0;
        const toY = to.canvasY || to.y || 0;
        
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const perpX = (-dy / dist) * 15;
        const perpY = (dx / dist) * 15;

        this.ctx.beginPath();
        this.ctx.moveTo(fromX, fromY);
        this.ctx.quadraticCurveTo(midX + perpX, midY + perpY, toX, toY);
        this.ctx.stroke();
      });
    });
  }

  drawRoads() {
    this.drawConnections(false);
  }

  drawPathTo(targetIndex) {
    const path = GridSystem.findPath(gameState.game.location, targetIndex);
    if (path.length <= 1) return;

    let totalDays = 0;
    for (let i = 1; i < path.length; i++) {
      totalDays += GridSystem.getGridDistance(path[i - 1], path[i]);
    }

    this.ctx.save();
    this.ctx.strokeStyle = "rgba(212, 175, 55, 0.6)";
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([5, 10]);
    this.ctx.lineCap = "round";

    this.ctx.beginPath();
    const startLoc = gameState.game.locations[path[0]];
    const startX = startLoc.canvasX || startLoc.x || 0;
    const startY = startLoc.canvasY || startLoc.y || 0;
    this.ctx.moveTo(startX, startY);
    
    for (let i = 1; i < path.length; i++) {
      const loc = gameState.game.locations[path[i]];
      const x = loc.canvasX || loc.x || 0;
      const y = loc.canvasY || loc.y || 0;
      this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();

    // Add travel day indicators
    const steps = Math.max(1, totalDays);
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const pointIndex = Math.floor(t * (path.length - 1));
      const prevIndex = Math.max(0, pointIndex - 1);
      const loc = gameState.game.locations[path[pointIndex]];
      const prev = gameState.game.locations[path[prevIndex]];
      
      const locX = loc.canvasX || loc.x || 0;
      const locY = loc.canvasY || loc.y || 0;
      const prevX = prev.canvasX || prev.x || 0;
      const prevY = prev.canvasY || prev.y || 0;
      
      const x = prevX + (locX - prevX) * (t * (path.length - 1) - prevIndex);
      const y = prevY + (locY - prevY) * (t * (path.length - 1) - prevIndex);

      this.ctx.font = "8px Arial";
      this.ctx.fillText("☀️", x - 8, y - 20);
    }

    this.ctx.restore();
  }

  drawTooltip(x, y, text) {
    const padding = 8;
    const fontSize = 14;
    this.ctx.font = `bold ${fontSize}px Consolas`;
    const width = this.ctx.measureText(text).width + padding * 2;
    const height = fontSize + padding * 2;

    // Background box
    this.ctx.fillStyle = "rgba(40, 30, 20, 0.9)";
    this.ctx.fillRect(x, y - height, width, height);
    this.ctx.strokeStyle = "rgba(212, 175, 55, 0.7)";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y - height, width, height);

    // Text
    this.ctx.fillStyle = "#e8dcc5";
    this.ctx.textAlign = "center";
    this.ctx.fillText(text, x + width / 2, y - height + fontSize / 2);
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    gameState.game.locations.forEach((location, i) => {
      const locX = location.canvasX || location.x || 0;
      const locY = location.canvasY || location.y || 0;
      const dist = Math.sqrt((x - locX) ** 2 + (y - locY) ** 2);
      
      if (dist <= 40) {
        // Create ripple effect
        const ripple = document.createElement("div");
        ripple.classList.add("ripple");
        ripple.style.left = `${locX}px`;
        ripple.style.top = `${locY}px`;
        ripple.style.transform = "translate(-50%, -50%)";

        const container = this.canvas.closest(".canvas-container") || this.canvas.parentElement;
        container.appendChild(ripple);

        setTimeout(() => ripple.remove(), 1500);

        // Travel or enter location
        if (i !== gameState.game.location) {
          travel(i);
        } else {
          enterLocation(i);
        }
      }
    });
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let hoverLocation = null;

    gameState.game.locations.forEach((location, i) => {
      const locX = location.canvasX || location.x || 0;
      const locY = location.canvasY || location.y || 0;
      const dist = Math.sqrt((x - locX) ** 2 + (y - locY) ** 2);
      
      if (dist <= 40 && i !== gameState.game.location) {
        hoverLocation = i;
      }
    });

    if (hoverLocation !== null) {
      const travelTime = GridSystem.getTravelTime(gameState.game.location, hoverLocation);
      const maxDay = gameState.game.rules.gameplay.maxDays;
      const arrivalDay = gameState.game.day + travelTime;

      if (travelTime === Infinity) {
        this.canvas.style.cursor = "not-allowed";
        this.canvas.title = "No path to this location";
      } else if (arrivalDay > maxDay) {
        this.canvas.style.cursor = "not-allowed";
        this.canvas.title = `Trip takes ${travelTime} days, but only ${maxDay - gameState.game.day} days left`;
      } else {
        this.canvas.style.cursor = "pointer";
        this.canvas.title = "";
      }

      this.hoverLocation = hoverLocation;
      this.draw();
    } else if (this.hoverLocation !== null) {
      this.hoverLocation = null;
      this.canvas.style.cursor = "default";
      this.canvas.title = "";
      this.draw();
    }
  }




}