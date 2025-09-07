// js/classes/ParchmentOverlay.js
// 🎨 Cozy Watercolor Map Overlay – Full Painterly Style
class ParchmentOverlay {
    constructor(width, height, themeName, seed) {
        this.width = width;
        this.height = height;
        this.themeName = themeName;
        this.seed = seed;
        this.canvas = null;
        this.ctx = null;
        this.biomeColors = {};
        this.biomeOrder = [];
        this.theme = null;
        this.mapData = null;
        this.renderScale = 1;
        this.tileSizeBase = 48;

        this.seedRandom = this.makeSeededRandom(seed);
    }

    makeSeededRandom(seed) {
        let s = (seed || 1) * 0x2f6e2b;
        return () => {
            s = (s * 0x41c64e6d + 12345) >>> 0;
            return (s & 0x7fffffff) / 0x7fffffff;
        };
    }

    noise(min, max) {
        return this.seedRandom() * (max - min) + min;
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }
    map(v, inMin, inMax, outMin, outMax) {
        return ((v - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    }

    parseColor(hex) {
        if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return { r: 100, g: 100, b: 100 };
        let h = hex.slice(1);
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (h.length !== 6) return { r: 100, g: 100, b: 100 };
        return {
            r: parseInt(h.slice(0, 2), 16) || 100,
            g: parseInt(h.slice(2, 4), 16) || 100,
            b: parseInt(h.slice(4, 6), 16) || 100,
        };
    }

    initFromTheme(theme) {
        this.theme = theme;
        this.biomeColors = {};
        Object.keys(theme.elevation).forEach((id) => {
            const visual = theme.elevation[id];
            const color = this.parseColor(visual.colors?.[0]);
            this.biomeColors[id] = {
                r: color.r,
                g: color.g,
                b: color.b,
                alpha: 0.75,
            };
        });

        // 💧 Water: richer, deeper
        if (this.biomeColors.water) {
            this.biomeColors.water.r = 80;
            this.biomeColors.water.g = 140;
            this.biomeColors.water.b = 255;
            this.biomeColors.water.alpha = 0.85;
        }

        this.biomeOrder = ["barrens", "water", "meadow", "forest", "spire"].filter((id) => this.biomeColors[id]);
    }

    setMapData(grid) {
        this.mapData = grid.map((row) => row.map((cell) => cell.terrain));
    }

    createCanvas() {
    // Get the main canvas dimensions to match exactly
    const mainCanvas = document.getElementById('canvas');
    if (!mainCanvas) {
        console.error("Main canvas not found");
        return null;
    }

    const rect = mainCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Create overlay canvas with exact same dimensions as main canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    // Style to match main canvas exactly
    this.canvas.style.position = "absolute";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.canvas.style.zIndex = "1";
    this.canvas.style.pointerEvents = "none";

    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.ctx.scale(dpr, dpr);

    // Store scaling info for render calculations
    this.renderScale = dpr;
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
    this.tileSizeBase = Math.min(rect.width, rect.height) / Math.max(this.width, this.height);

    return this.canvas;
}

    render() {
        if (!this.ctx || !this.mapData) return;

        const w = this.width;
        const h = this.height;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Base parchment
        ctx.fillStyle = "#f0cb9bff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Generate soft sites
        const sites = this.computeVoronoiSites(canvasWidth, canvasHeight, w, h);

        // Draw biomes in order
        this.biomeOrder.forEach((biomeId) => {
            const color = this.biomeColors[biomeId];
            if (!color) return;

            ctx.save();
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 0.8;

            this.drawBiomeWatercolorWash(ctx, sites, biomeId, color, canvasWidth, canvasHeight);
            this.drawBiomeBrushstrokes(ctx, sites, biomeId, color, canvasWidth, canvasHeight);
            ctx.restore();
        });

        // Draw biome-specific art at centers
        const size = canvasWidth / this.width;
        sites.forEach((site) => {
            const { col, row } = site;
            if (row >= h || col >= w || row < 0 || col < 0) return;
            const biomeId = this.mapData[row][col];
            if (!biomeId || !this.biomeColors[biomeId]) return;
            this.drawBiomeArtAt(site.x, site.y, biomeId, size);
        });

        // ✨ Special Effects
        this.drawWatercolorBackruns(ctx, sites); // Pigment blooms
        this.drawForestMossBleed(ctx, sites); // Mossy forest edges
        this.drawChalkyMountains(ctx, sites); // Dry chalk texture on spires
        this.drawBiomeBleedBorders(ctx, sites); // General soft borders
        this.addParchmentTexture(); // Paper grain
        this.drawHandDrawnBorder(ctx, canvasWidth, canvasHeight); // Outer sketch

        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = "source-over";
        // At the end of render()
        this.addFinalBlur();
    }

    computeVoronoiSites(canvasWidth, canvasHeight, cols, rows) {
        const sites = [];
        const dx = canvasWidth / cols;
        const dy = canvasHeight / rows;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = (col + 0.5 + this.noise(-0.5, 0.5) * 0.6) * dx;
                const y = (row + 0.5 + this.noise(-0.5, 0.5) * 0.6) * dy;
                sites.push({ x, y, col, row });
            }
        }
        return sites;
    }

    drawBiomeWatercolorWash_hybrids(ctx, sites, biomeId, color, canvasWidth, canvasHeight) {
        const tileSize = this.tileSizeBase * this.renderScale;
        const noiseScale = 0.008;

        if (["water", "forest", "meadow"].includes(biomeId)) {
            // 🌿 Organic Biomes: Soft radial gradient per site
            sites.forEach((site) => {
                const { col, row, x, y } = site;
                if (row >= this.height || col >= this.width || this.mapData[row][col] !== biomeId) return;

                let alpha = color.alpha;
                const n = this.fbm(x * noiseScale, y * noiseScale, 2, 0.6);
                alpha *= this.lerp(0.75, 1.1, n);

                if (biomeId === "water") {
                    const clusterCenter = this.getWaterClusterCenter(col, row);
                    const dx = (col - clusterCenter.cx) * tileSize;
                    const dy = (row - clusterCenter.cy) * tileSize;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    alpha *= this.map(dist, 0, 180, 1.0, 0.5);
                }

                const radius = tileSize * 0.9;
                const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
                grad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`);
                grad.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.6})`);
                grad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

                ctx.save();
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = 1;
                ctx.fillStyle = grad;
                ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
                ctx.restore();
            });
        } else if (["spire", "barrens"].includes(biomeId)) {
            // ⛰️ Rocky/Arid Biomes: Crisp, textured tile fills
            const step = Math.max(2, Math.floor(tileSize / 12)); // High-res fill
            const baseAlpha = color.alpha * 0.9;

            for (let row = 0; row < this.height; row++) {
                const step = 10;
                const noiseScale = 0.015;

                let baseMin = 0.3;
                let baseMax = 0.6;
                let useDepthShading = true;

                if (biomeId === "water") {
                    baseMin = 0.4;
                    baseMax = 0.75;
                    useDepthShading = true;
                }

                for (let y = 0; y < canvasHeight; y += step) {
                    for (let x = 0; x < canvasWidth; x += step) {
                        const site = this.findClosestSite(sites, x, y);
                        const { col, row } = site;
                        if (row < 0 || row >= this.height || col < 0 || col >= this.width || this.mapData[row][col] !== biomeId) continue;

                        const n = this.fbm(x * noiseScale, y * noiseScale, 2, 0.6);
                        let alpha = this.lerp(baseMin, baseMax, n) * color.alpha;

                        if (useDepthShading) {
                            const clusterCenter = this.getWaterClusterCenter(col, row);
                            const dx = (col - clusterCenter.cx) * 48;
                            const dy = (row - clusterCenter.cy) * 48;
                            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                            const falloff = this.map(distFromCenter, 0, 120, 1.0, 0.6);
                            alpha *= falloff;
                        }

                        ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
                        ctx.fillRect(x, y, step, step);
                    }
                }
            }
        }
    }

    // 🌊 Water with depth shading (good one)
    drawBiomeWatercolorWash(ctx, sites, biomeId, color, canvasWidth, canvasHeight) {
        const step = 7; // 7 is good
        const noiseScale = 0.015;

        let baseMin = 0.3;
        let baseMax = 0.6;
        let useDepthShading = true;

        if (biomeId === "water") {
            baseMin = 0.4;
            baseMax = 0.75;
            useDepthShading = true;
        }

        for (let y = 0; y < canvasHeight; y += step) {
            for (let x = 0; x < canvasWidth; x += step) {
                const site = this.findClosestSite(sites, x, y);
                const { col, row } = site;
                if (row < 0 || row >= this.height || col < 0 || col >= this.width || this.mapData[row][col] !== biomeId) continue;

                const n = this.fbm(x * noiseScale, y * noiseScale, 2, 0.6);
                let alpha = this.lerp(baseMin, baseMax, n) * color.alpha;

                if (useDepthShading) {
                    const clusterCenter = this.getWaterClusterCenter(col, row);
                    const dx = (col - clusterCenter.cx) * 48;
                    const dy = (row - clusterCenter.cy) * 48;
                    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                    const falloff = this.map(distFromCenter, 0, 120, 1.0, 0.6);
                    alpha *= falloff;
                }

                ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
                ctx.fillRect(x, y, step, step);
            }
        }
    }

    getWaterClusterCenter(col, row) {
        const maxDist = 3;
        const queue = [{ col, row, dist: 0 }];
        const visited = new Set();
        const waterCells = [];

        while (queue.length > 0) {
            const { col, row, dist } = queue.shift();
            const key = `${col},${row}`;
            if (visited.has(key) || dist > maxDist) continue;
            visited.add(key);

            if (this.mapData[row]?.[col] === "water") {
                waterCells.push({ col, row });
                for (const [dx, dy] of [
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1],
                ]) {
                    queue.push({ col: col + dx, row: row + dy, dist: dist + 1 });
                }
            }
        }

        if (waterCells.length === 0) return { cx: col, cy: row };

        const cx = waterCells.reduce((sum, c) => sum + c.col, 0) / waterCells.length;
        const cy = waterCells.reduce((sum, c) => sum + c.row, 0) / waterCells.length;
        return { cx, cy };
    }

    // 🖌️ General brushstrokes (used by all biomes)
    drawBiomeBrushstrokes(ctx, sites, biomeId, color, canvasWidth, canvasHeight) {
        const strokeCount = this.width * this.height * 0.8;
        for (let i = 0; i < strokeCount; i++) {
            const site = sites[Math.floor(this.noise(0, sites.length))];
            const { col, row } = site;
            if (row >= this.height || col >= this.width || this.mapData[row][col] !== biomeId) continue;

            const x = site.x + this.noise(-20, 20);
            const y = site.y + this.noise(-20, 20);
            const angle = this.noise(0, Math.PI * 2);
            const length = this.noise(6, 14) * (this.renderScale || 1);
            const width = this.noise(1.5, 3.5);
            const alpha = this.noise(0.3, 0.55);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
            ctx.lineWidth = width;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(-length / 2, this.noise(-2, 2));
            ctx.quadraticCurveTo(0, this.noise(-1, 1), length / 2, this.noise(-2, 2));
            ctx.stroke();
            ctx.restore();
        }
    }

    // 🌿 Forest moss bleed at edges
    drawForestMossBleed(ctx, sites) {
        const w = this.width;
        const h = this.height;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const step = 8;

        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.22;

        for (let y = 0; y < canvasHeight; y += step) {
            for (let x = 0; x < canvasWidth; x += step) {
                const site = this.findClosestSite(sites, x, y);
                const { col, row } = site;
                if (row < 0 || row >= h || col < 0 || col >= w || this.mapData[row][col] !== "forest") continue;

                const neighbors = [
                    [col - 1, row],
                    [col + 1, row],
                    [col, row - 1],
                    [col, row + 1],
                ];
                const isEdge = neighbors.some(([nx, ny]) => {
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
                    return this.mapData[ny][nx] !== "forest";
                });

                if (isEdge) {
                    const r = this.noise(4, 9);
                    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
                    grad.addColorStop(0, "rgba(60, 110, 60, 0.3)");
                    grad.addColorStop(1, "rgba(60, 110, 60, 0)");
                    ctx.fillStyle = grad;
                    ctx.fillRect(x - r, y - r, r * 2, r * 2);
                }
            }
        }
        ctx.restore();
    }

    // ⛰️ Chalky texture on mountains (spires)
    drawChalkyMountains(ctx, sites) {
        ctx.save();
        ctx.globalCompositeOperation = "color-dodge"; // Lighten effect
        ctx.globalAlpha = 0.15;

        sites.forEach((site) => {
            const { col, row } = site;
            if (row >= this.height || col >= this.width || this.mapData[row][col] !== "spire") return;

            const count = 8;
            for (let i = 0; i < count; i++) {
                const x = site.x + this.noise(-20, 20);
                const y = site.y + this.noise(-20, 20);
                const len = this.noise(6, 14);
                const angle = this.noise(0, Math.PI * 2);
                ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
                ctx.lineWidth = this.noise(0.5, 1.5);
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    // 🌼 Watercolor backruns (pigment blooms)
    drawWatercolorBackruns(ctx, sites) {
        const count = this.width * this.height * 0.3;
        for (let i = 0; i < count; i++) {
            const site = sites[Math.floor(this.noise(0, sites.length))];
            const { col, row } = site;
            if (row >= this.height || col >= this.width) continue;

            const biomeId = this.mapData[row][col];
            if (!["water", "forest", "meadow"].includes(biomeId)) continue;

            const x = site.x + this.noise(-20, 20);
            const y = site.y + this.noise(-20, 20);
            const color = this.biomeColors[biomeId];

            const r1 = this.noise(8, 14);
            const grad1 = ctx.createRadialGradient(x, y, 0, x, y, r1);
            grad1.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.5)`);
            grad1.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.05)`);
            ctx.fillStyle = grad1;
            ctx.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);

            const r2 = r1 * 1.8;
            const grad2 = ctx.createRadialGradient(x, y, r1, x, y, r2);
            grad2.addColorStop(0, `rgba(255, 255, 255, 0)`);
            grad2.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`);
            ctx.fillStyle = grad2;
            ctx.fillRect(x - r2, y - r2, r2 * 2, r2 * 2);
        }
    }

    // 🌱 Meadow stippling (like sponge dab)
    drawBiomeArtAt(x, y, biomeId, size) {
        const ctx = this.ctx;
        const scale = size / 48;

        if (biomeId === "meadow") {
            for (let i = 0; i < 12; i++) {
                const rx = x + this.noise(-20, 20) * scale;
                const ry = y + this.noise(-20, 20) * scale;
                const r = this.noise(1.5, 4) * scale;
                const alpha = this.noise(0.2, 0.4);
                ctx.fillStyle = `rgba(163, 230, 53, ${alpha})`;
                ctx.beginPath();
                ctx.arc(rx, ry, r, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (biomeId === "water") {
            for (let i = 0; i < 4; i++) {
                const dy = 8 * scale + i * 12 * scale;
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 + this.noise(0, 0.1)})`;
                ctx.lineWidth = 1.2 * scale;
                ctx.beginPath();
                ctx.moveTo(x - 22 * scale, y + dy);
                const amp = this.noise(-10, 10) * scale;
                const offset = this.noise(-8, 8) * scale;
                ctx.quadraticCurveTo(x + offset, y + dy + amp, x + 22 * scale, y + dy);
                // ctx.stroke();
            }
            for (let i = 0; i < 2; i++) {
                const yy = y + this.noise(10, 40) * scale;
                ctx.strokeStyle = `rgba(255, 255, 255, 0.12)`;
                ctx.lineWidth = 1 * scale;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(x - 20 * scale, yy);
                ctx.lineTo(x + 20 * scale, yy);
                ctx.stroke();
            }
        } else if (biomeId === "forest") {
            for (let i = 0; i < 21; i++) {
                const rx = x + this.noise(-24, 24) * scale;
                const ry = y + this.noise(-24, 24) * scale;
                const dotSize = (2 + this.noise(0, 3)) * scale;
                ctx.fillStyle = `rgba(30, 100, 50, ${0.5 + this.noise(0, 0.3)})`;
                ctx.beginPath();
                ctx.arc(rx, ry, dotSize, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (biomeId === "spire") {
            for (let i = 0; i < 3; i++) {
                const dy = -8 * scale + i * 15 * scale;
                ctx.strokeStyle = `rgba(100, 100, 100, 0.3)`;
                ctx.lineWidth = 2 * scale;
                const startX = x - 20 * scale + this.noise(0, 9) * scale;
                const endX = x + 5 * scale + this.noise(0, 15) * scale;
                if (startX >= endX) continue;
                const midX = (startX + endX) / 2;
                const depth = (8 + this.noise(0, 8)) * scale;
                const peakOffset = this.noise(-5, 5) * scale;
                ctx.beginPath();
                ctx.moveTo(startX, y + dy);
                ctx.lineTo(midX + peakOffset, y + dy - depth);
                ctx.lineTo(endX, y + dy);
                ctx.stroke();
            }
        } else if (biomeId === "barrens") {
            for (let i = 0; i < 7; i++) {
                const rx = x + this.noise(-24, 24) * scale;
                const ry = y + this.noise(-24, 24) * scale;
                ctx.save();
                ctx.translate(rx, ry);
                ctx.rotate(this.noise(0, Math.PI * 2));
                ctx.fillStyle = `rgba(160, 30, 60, 0.3)`;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                for (let j = 0; j < 5; j++) {
                    const angle = (Math.PI * 2 * j) / 5;
                    const len = 4 + this.noise(0, 8);
                    const px = Math.cos(angle) * len * scale;
                    const py = Math.sin(angle) * len * scale;
                    ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }
    }

    // 🎨 Noise & Math
    fbm(x, y, octaves = 3, persistence = 0.5) {
        let value = 0,
            amplitude = 1,
            frequency = 1,
            max = 0;
        for (let i = 0; i < octaves; i++) {
            value += this.simplex2(x * frequency, y * frequency) * amplitude;
            max += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        return (value / max + 1) / 2; // 0–1
    }

    simplex2(x, y) {
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1; // -1 to 1
    }

    findClosestSite(sites, x, y) {
        let best = sites[0];
        let bestDist = Infinity;
        for (const site of sites) {
            const dx = site.x - x;
            const dy = site.y - y;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                best = site;
                bestDist = d;
            }
        }
        return best;
    }

    // 📜 Paper texture
    addParchmentTexture() {
        const scale = this.renderScale || 1;
        const texSize = 512 * scale;
        const texCanvas = document.createElement("canvas");
        texCanvas.width = texSize;
        texCanvas.height = texSize;
        const texCtx = texCanvas.getContext("2d");

        texCtx.fillStyle = "#e7c496";
        texCtx.fillRect(0, 0, texSize, texSize);

        const dotCount = 1000 * scale;
        for (let i = 0; i < dotCount; i++) {
            const x = this.noise(0, texSize);
            const y = this.noise(0, texSize);
            const r = this.noise(0.5, 2) * scale;
            texCtx.fillStyle = `rgba(200, 180, 150, ${this.noise(0, 0.15)})`;
            texCtx.beginPath();
            texCtx.arc(x, y, r, 0, Math.PI * 2);
            texCtx.fill();
        }

        const fiberCount = 60 * scale;
        for (let i = 0; i < fiberCount; i++) {
            const x1 = this.noise(0, texSize);
            const y1 = this.noise(0, texSize);
            const x2 = x1 + this.noise(0, 200 * scale);
            const y2 = y1 + this.noise(0, 200 * scale);
            texCtx.strokeStyle = `rgba(200, 180, 150, 0.3)`;
            texCtx.lineWidth = 0.4 * scale;
            texCtx.beginPath();
            texCtx.moveTo(x1, y1);
            texCtx.lineTo(x2, y2);
            texCtx.stroke();
        }

        this.ctx.globalAlpha = 0.4;
        this.ctx.globalCompositeOperation = "multiply";
        this.ctx.drawImage(texCanvas, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.globalAlpha = 1.0;
    }

    // ✏️ Hand-drawn border
    drawHandDrawnBorder(ctx, width, height) {
        ctx.save();
        ctx.strokeStyle = "rgba(100, 90, 80, 0.2)";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        const pad = 10;
        const points = [
            { x: pad, y: pad },
            { x: width - pad, y: pad },
            { x: width - pad, y: height - pad },
            { x: pad, y: height - pad },
        ];

        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const a = points[i];
            const b = points[(i + 1) % 4];
            const mx = (a.x + b.x) / 2 + this.noise(-8, 8);
            const my = (a.y + b.y) / 2 + this.noise(-8, 8);
            if (i === 0) ctx.moveTo(a.x + this.noise(-5, 5), a.y + this.noise(-5, 5));
            ctx.quadraticCurveTo(mx, my, b.x + this.noise(-5, 5), b.y + this.noise(-5, 5));
        }
        ctx.stroke();
        ctx.restore();
    }

    // 🌫️ Soft biome borders
    drawBiomeBleedBorders(ctx, sites) {
        const w = this.width;
        const h = this.height;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const step = 4;

        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = 0.15;

        for (let y = step / 2; y < canvasHeight; y += step) {
            for (let x = step / 2; x < canvasWidth; x += step) {
                const site = this.findClosestSite(sites, x, y);
                const { col, row } = site;
                if (row < 0 || row >= h || col < 0 || col >= w) continue;

                const neighbors = [
                    [col - 1, row],
                    [col + 1, row],
                    [col, row - 1],
                    [col, row + 1],
                ];
                const isEdge = neighbors.some(([nx, ny]) => {
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false;
                    return this.mapData[ny][nx] !== this.mapData[row][col];
                });

                if (isEdge) {
                    const color = this.biomeColors[this.mapData[row][col]];
                    if (!color) continue;
                    const alpha = this.noise(0.2, 0.4);
                    ctx.fillStyle = `rgba(80, 70, 60, ${alpha})`;
                    ctx.fillRect(x - 1, y - 1, 2, 2);
                }
            }
        }
        ctx.restore();
    }

    addFinalBlur() {
        const ctx = this.ctx;
        const canvas = this.canvas;

        // Create offscreen buffer for blur
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;

        // Draw current canvas to temp (blurring happens via scaling)
        tempCtx.drawImage(canvas, 0, 0);

        // Reduce size slightly and scale back up with smoothing
        const shrink = 2;
        const smallW = canvas.width / shrink;
        const smallH = canvas.height / shrink;

        const smallCanvas = document.createElement("canvas");
        const smallCtx = smallCanvas.getContext("2d");
        smallCanvas.width = smallW;
        smallCanvas.height = smallH;

        // Shrink with smoothing
        smallCtx.imageSmoothingEnabled = true;
        smallCtx.imageSmoothingQuality = "high";
        smallCtx.drawImage(tempCanvas, 0, 0, smallW, smallH);

        // Blur slightly
        //smallCtx.filter = "blur(0.8px)";
        smallCtx.drawImage(smallCanvas, 0, 0, smallW, smallH);

        // Draw back to main canvas, scaled up smoothly
        ctx.filter = "none";
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(smallCanvas, 0, 0, smallW, smallH, 0, 0, canvas.width, canvas.height);

        // Optional: very light noise to break up banding
        //this.addSubtleNoise(ctx, canvas.width, canvas.height);
    }

    addSubtleNoise(ctx, width, height) {
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = this.noise(-10, 10);
            data[i + 0] += noise; // R
            data[i + 1] += noise; // G
            data[i + 2] += noise; // B
            // Alpha unchanged
        }

        ctx.putImageData(imageData, 0, 0);
    }
}
export { ParchmentOverlay };