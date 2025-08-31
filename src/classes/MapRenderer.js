// Map Renderer - Enhanced with Visual Travel Paths & Custom Tooltip
export class MapRenderer {
  
  constructor(canvas) {
    console.log("renderer loading...");
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.hoverLocation = null; // Track hover state

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
    const minSeparation = 100;
    gameState.game.locations.forEach((location, i) => {
      const gridPos = GridSystem.findLocationPosition(i);
      if (gridPos) {
        const gridWidth = gameState.game.rules.grid.width;
        const gridHeight = gameState.game.rules.grid.height;
        let x = margin + (gridPos.x / (gridWidth - 1)) * w;
        let y = margin + (gridPos.y / (gridHeight - 1)) * h;

        const locationSeed = gameState.game.seed + i * 17;
        const pseudoRand1 = ((locationSeed * 9301 + 49297) % 233280) / 233280;
        const pseudoRand2 = (((locationSeed + 1) * 9301 + 49297) % 233280) / 233280;
        const offset = 30;
        x += (pseudoRand1 - 0.5) * offset;
        y += (pseudoRand2 - 0.5) * offset;

        let attempts = 0;
        while (attempts < 50) {
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
          const newSeed = locationSeed + attempts * 7;
          const newRand1 = ((newSeed * 9301 + 49297) % 233280) / 233280;
          const newRand2 = (((newSeed + 1) * 9301 + 49297) % 233280) / 233280;
          x = margin + (gridPos.x / (gridWidth - 1)) * w;
          y = margin + (gridPos.y / (gridHeight - 1)) * h;
          x += (newRand1 - 0.5) * (offset + attempts * 10);
          y += (newRand2 - 0.5) * (offset + attempts * 10);
          attempts++;
        }

        location.x = Math.max(margin + 50, Math.min(this.displayWidth - margin - 50, x));
        location.y = Math.max(margin + 50, Math.min(this.displayHeight - margin - 50, y));
      }
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
    this.ctx.lineWidth = 2;
    gameState.game.locations.forEach((from, i) => {
      const distances = gameState.game.locations
        .map((to, j) => ({
          index: j,
          dist: Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2),
        }))
        .filter((d) => d.index !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      distances.forEach(({ index }) => {
        const to = gameState.game.locations[index];
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const perpX = (-dy / dist) * 20;
        const perpY = (dx / dist) * 20;
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

    this.ctx.save();
    this.ctx.strokeStyle = "rgba(212, 175, 55, 0.6)"; // Gold, soft
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([5, 10]);
    this.ctx.lineCap = "round";

    // Draw path
    this.ctx.beginPath();
    const startLoc = gameState.game.locations[path[0]];
    this.ctx.moveTo(startLoc.x, startLoc.y);
    for (let i = 1; i < path.length; i++) {
      const loc = gameState.game.locations[path[i]];
      this.ctx.lineTo(loc.x, loc.y);
    }
    this.ctx.stroke();

    // Add day markers (☀️) at each node except start
    for (let i = 1; i < path.length; i++) {
      const loc = gameState.game.locations[path[i]];
      this.ctx.font = "16px Arial";
      //this.ctx.fillText("☀️", loc.x - 8, loc.y - 20);
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
    this.ctx.fillText(text, x + width / 2, y - height + fontSize / 2);
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    gameState.game.locations.forEach((location, i) => {
      const dist = Math.sqrt((x - location.x) ** 2 + (y - location.y) ** 2);
      if (dist <= 40) {
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
      const dist = Math.sqrt((x - location.x) ** 2 + (y - location.y) ** 2);
      if (dist <= 40 && i !== gameState.game.location) {
        hoverLocation = i;
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
}
