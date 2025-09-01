// Map Renderer - Enhanced with Visual Travel Paths & Custom Tooltip
export class MapRenderer {
  constructor(canvas) {
    console.log("renderer loading...");
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hoverLocation = null; // Track hover state
    // In MapRenderer.js, after constructor
    //this.updateCanvasSize();

    // Event listeners
    canvas.addEventListener("click", this.handleClick.bind(this));
    canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    canvas.addEventListener("mouseout", () => {
      this.hoverLocation = null;
      this.canvas.title = "";
      this.canvas.style.cursor = "default";
      this.draw(); // Redraw without hover effects
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
    const minSeparation = 120; // Increased separation distance
    const maxOffset = 60; // Larger base offset range

    gameState.game.locations.forEach((location, i) => {
      const gridPos = GridSystem.findLocationPosition(i);
      if (!gridPos) return;

      const gridWidth = gameState.game.rules.grid.width;
      const gridHeight = gameState.game.rules.grid.height;

      // Base position from grid
      let x = margin + (gridPos.x / (gridWidth - 1)) * w;
      let y = margin + (gridPos.y / (gridHeight - 1)) * h;

      // Apply large random offset
      const locationSeed = gameState.game.seed + i * 17;
      const rand1 = ((locationSeed * 9301 + 49297) % 233280) / 233280;
      const rand2 = (((locationSeed + 1) * 9301 + 49297) % 233280) / 233280;
      x += (rand1 - 0.5) * maxOffset;
      y += (rand2 - 0.5) * maxOffset;

      // Attempt to resolve collisions up to 100 times
      let attempts = 0;
      while (attempts < 100) {
        let tooClose = false;
        for (let j = 0; j < i; j++) {
          const other = gameState.game.locations[j];
          if (other.x !== undefined && other.y !== undefined) {
            const dist = Math.sqrt((x - other.x) ** 2 + (y - other.y) ** 2);
            if (dist < minSeparation) {
              tooClose = true;
              break;
            }
          }
        }

        if (!tooClose) break;

        // If we're too close, push this location away from the nearest one
        let closestDist = Infinity;
        let closestX = x,
          closestY = y;
        for (let j = 0; j < i; j++) {
          const other = gameState.game.locations[j];
          if (other.x !== undefined && other.y !== undefined) {
            const dx = x - other.x;
            const dy = y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) {
              closestDist = dist;
              // Push away from the closest location
              const pushFactor = 1.5;
              closestX = x + (dx / dist) * pushFactor * (minSeparation - closestDist);
              closestY = y + (dy / dist) * pushFactor * (minSeparation - closestDist);
            }
          }
        }
        x = closestX;
        y = closestY;
        attempts++;
      }

      // Clamp within bounds
      location.x = Math.max(margin + 50, Math.min(this.displayWidth - margin - 50, x));
      location.y = Math.max(margin + 50, Math.min(this.displayHeight - margin - 50, y));
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
    this.drawRoads();

    // Draw all locations
    gameState.game.locations.forEach((location, i) => {
      const isPlayer = i === gameState.game.location;
      const radius = 32;
      this.ctx.beginPath();
      this.ctx.arc(location.x, location.y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = isPlayer ? "#4a5a35" : "#2d2d20";
      this.ctx.fill();
      this.ctx.strokeStyle = isPlayer ? "#ffd700" : "#6a6a45";
      this.ctx.lineWidth = isPlayer ? 3 : 1;
      this.ctx.stroke();
      //emoji size
      this.ctx.font = "24px Consolas";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillStyle = "#f4e4bc";
      this.ctx.fillText(location.emoji, location.x, location.y);

      this.ctx.font = "12px Consolas";
      this.ctx.textBaseline = "top";
      //this.ctx.fillText(location.name, location.x, location.y + radius + Math.random() * (20 - 6 + 1));
      this.ctx.fillText(location.name, location.x, location.y + radius + 8);
    });

    // Redraw hover effect if still active
    if (this.hoverLocation !== null && this.hoverLocation !== gameState.game.location) {
      this.drawPathTo(this.hoverLocation);
      const loc = gameState.game.locations[this.hoverLocation];
      this.drawTooltip(loc.x + 50, loc.y, `${GridSystem.getGridDistance(gameState.game.location, this.hoverLocation)} days 🗺️`);
    }
  }

  drawRoads() {
    this.ctx.strokeStyle = "#8b7355";
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([5, 5]); // Dashed lines for softness

    gameState.game.locations.forEach((from, i) => {
      const connections = gameState.game.connections[i] || [];
      connections.forEach((j) => {
        if (i >= j) return; // Draw each road once
        const to = gameState.game.locations[j];
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const perpX = (-dy / dist) * 15;
        const perpY = (dx / dist) * 15;

        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.quadraticCurveTo(midX + perpX, midY + perpY, to.x, to.y);
        this.ctx.stroke();
      });
    });
  }

  drawPathTo(targetIndex) {
    const path = GridSystem.findPath(gameState.game.location, targetIndex);
    if (path.length <= 1) return;

    // Calculate total travel days using grid distance
    let totalDays = 0;
    for (let i = 1; i < path.length; i++) {
      totalDays += GridSystem.getGridDistance(path[i - 1], path[i]);
    }

    // Draw the path
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(212, 175, 55, 0.6)";
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([5, 10]);
    this.ctx.lineCap = "round";

    this.ctx.beginPath();
    const startLoc = gameState.game.locations[path[0]];
    this.ctx.moveTo(startLoc.x, startLoc.y);
    for (let i = 1; i < path.length; i++) {
      const loc = gameState.game.locations[path[i]];
      this.ctx.lineTo(loc.x, loc.y);
    }
    this.ctx.stroke();

    // Add sun icons (☀️) for each *day* of travel, spaced along the path
    const steps = Math.max(1, totalDays);
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const pointIndex = Math.floor(t * (path.length - 1));
      const prevIndex = Math.max(0, pointIndex - 1);
      const loc = gameState.game.locations[path[pointIndex]];
      const prev = gameState.game.locations[path[prevIndex]];
      const x = prev.x + (loc.x - prev.x) * (t * (path.length - 1) - prevIndex);
      const y = prev.y + (loc.y - prev.y) * (t * (path.length - 1) - prevIndex);

      this.ctx.font = "8px Arial";
      this.ctx.fillText("☀️", x - 8, y - 20);
    }

    this.ctx.restore();

    // Show tooltip with total days
    const loc = gameState.game.locations[targetIndex];
    this.drawTooltip(loc.x + 50, loc.y, `${totalDays} days 🗺️`);
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
    this.ctx.fillText(text, x + width / 2, y - height + fontSize / 2);
  }

handleClick(e) {
  const rect = this.canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  gameState.game.locations.forEach((location, i) => {
    const dist = Math.sqrt((x - location.x) ** 2 + (y - location.y) ** 2);
    if (dist <= 40) {
      // ✅ Create ripple at location.x, location.y
      const ripple = document.createElement("div");
      ripple.classList.add("ripple");
      ripple.style.left = `${location.x}px`;
      ripple.style.top = `${location.y}px`;
      ripple.style.transform = "translate(-50%, -50%)"; // Center on point

      // ✅ Append to .canvas-container, not canvas.parentElement
      const container = this.canvas.closest(".canvas-container");
      container.appendChild(ripple);

      // Remove after animation
      setTimeout(() => ripple.remove(), 1500);

      // Travel logic
      if (i !== gameState.game.location) {
        travel(i);
      } else {
        enterLocation(i);
      }
    }
  });
}

  handleMouseMove_old(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let hoverLocation = null;

    gameState.game.locations.forEach((location, i) => {
      const dist = Math.sqrt((x - location.x) ** 2 + (y - location.y) ** 2);
      if (dist <= 40 && i !== gameState.game.location) {
        hoverLocation = i;

        const canTravel = GridSystem.getTravelTime(gameState.game.location, hoverLocation) !== Infinity;
        if (!canTravel) {
          this.canvas.style.cursor = "not-allowed";
        } else {
          this.canvas.style.cursor = "pointer";
        }
      }
    });

    if (hoverLocation !== null) {
      this.hoverLocation = hoverLocation;
      this.canvas.style.cursor = "pointer";
      this.draw(); // Redraw with path and tooltip
    } else if (this.hoverLocation !== null) {
      this.hoverLocation = null;
      this.canvas.style.cursor = "default";
      this.draw(); // Clear hover effect
    }
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let hoverLocation = null;

    gameState.game.locations.forEach((location, i) => {
      const dist = Math.sqrt((x - location.x) ** 2 + (y - location.y) ** 2);
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
      this.draw(); // Redraw with path and tooltip
    } else if (this.hoverLocation !== null) {
      this.hoverLocation = null;
      this.canvas.style.cursor = "default";
      this.canvas.title = "";
      this.draw();
    }
  }
}
