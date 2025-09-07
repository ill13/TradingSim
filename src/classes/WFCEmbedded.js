// src/classes/WFCEmbedded.js
// Minimal embedded versions of WFC classes for trading sim integration

// Template placer for WFC patterns
class TemplatePlacer {
    static applyTo(wfc, templates) {
        if (!templates || Object.keys(templates).length === 0) return;

        const templateList = Object.entries(templates).map(([id, t]) => ({ id, ...t }));
        const numToApply = Math.floor(Math.random() * 2) + 1;
        
        for (let i = 0; i < numToApply; i++) {
            if (templateList.length === 0) break;
            const template = this.getRandomTemplate(templateList);
            const applied = this.applyTemplateToGrid(template, wfc.grid, wfc.width, wfc.height);
            if (applied) {
                wfc.log(`🎨 Applied template: ${template.id}`);
            }
        }
    }

    static getRandomTemplate(templates) {
        const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
        let r = Math.random() * totalWeight;
        for (const template of templates) {
            r -= template.weight;
            if (r <= 0) return template;
        }
        return templates[0];
    }

    static getPlacementPosition(template, width, height) {
        const tWidth = template.pattern[0]?.length || 0;
        const tHeight = template.pattern.length || 0;
        if (tWidth === 0 || tHeight === 0) return { x: 0, y: 0 };

        let x, y;
        switch (template.placement) {
            case "center":
                x = Math.floor((width - tWidth) / 2);
                y = Math.floor((height - tHeight) / 2);
                break;
            case "top_left":
                x = 0;
                y = 0;
                break;
            default: // "any"
                x = Math.floor(Math.random() * (width - tWidth + 1));
                y = Math.floor(Math.random() * (height - tHeight + 1));
        }
        x = Math.max(0, Math.min(x, width - tWidth));
        y = Math.max(0, Math.min(y, height - tHeight));
        return { x, y };
    }

    static applyTemplateToGrid(template, grid, width, height) {
        const { x: startX, y: startY } = this.getPlacementPosition(template, width, height);
        const pattern = template.pattern;

        for (let dy = 0; dy < pattern.length; dy++) {
            for (let dx = 0; dx < pattern[dy].length; dx++) {
                const x = startX + dx;
                const y = startY + dy;
                const terrainType = pattern[dy][dx];
                if (terrainType === null || terrainType === "") continue;
                const cell = grid[y]?.[x];
                if (!cell) continue;
                cell.possibilities = [terrainType];
                cell.collapsed = false;
            }
        }
        return true;
    }
}

// Core Wave Function Collapse implementation
class WaveFunctionCollapse {
    constructor(width, height, themeName = 'fantasy') {
        this.width = width;
        this.height = height;
        this.themeName = themeName;
        this.grid = [];
        this.stepCount = 0;
        this.locationCount = 0;
        this.isGenerating = false;
        this.autoSpeed = 0;
        this.placedLocations = [];
        this.mapName = "";
        this.parchment = null;
        this.init();
    }

    init() {
        this.grid = [];
        this.stepCount = 0;
        this.locationCount = 0;
        this.placedLocations = [];

        for (let y = 0; y < this.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = {
                    possibilities: Object.keys(window.TERRAIN_TYPES),
                    collapsed: false,
                    terrain: null,
                    location: null,
                };
            }
        }
        this.log(`Initialized ${this.width}x${this.height} grid`);
    }

    getCell(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
        return this.grid[y][x];
    }

    getNeighbors(x, y) {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        return directions.map(([dx, dy]) => ({ 
            x: x + dx, 
            y: y + dy, 
            cell: this.getCell(x + dx, y + dy) 
        })).filter((n) => n.cell);
    }

    findLowestEntropy() {
        let minEntropy = Infinity;
        let candidates = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.grid[y][x];
                if (!cell.collapsed && cell.possibilities.length < minEntropy) {
                    minEntropy = cell.possibilities.length;
                    candidates = [{ x, y }];
                } else if (!cell.collapsed && cell.possibilities.length === minEntropy) {
                    candidates.push({ x, y });
                }
            }
        }
        return candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : null;
    }

    collapseCell(x, y) {
        const cell = this.grid[y][x];
        if (cell.collapsed) return false;

        let weights = {};
        for (const t of cell.possibilities) {
            let weight = window.TERRAIN_TYPES[t].weight;
            const neighborMatchCount = this.getNeighbors(x, y).filter((n) => 
                n.cell.collapsed && n.cell.terrain === t
            ).length;
            weight *= Math.pow(1.7, neighborMatchCount);
            weights[t] = weight;
        }

        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        if (totalWeight === 0) return false;

        let r = Math.random() * totalWeight;
        let selected = cell.possibilities[0];
        for (const t of cell.possibilities) {
            r -= weights[t];
            if (r <= 0) {
                selected = t;
                break;
            }
        }

        const theme = window.ThemeManager.current;
        const terrainVisual = theme.elevation[selected];
        const chosenColor = window.ThemeManager.getRandomColor(terrainVisual.colors);

        cell.terrain = selected;
        cell.possibilities = [selected];
        cell.collapsed = true;
        cell.color = chosenColor;

        this.log(`Collapsed (${x}, ${y}) → ${selected}`);
        return true;
    }

    propagate(x, y) {
        const queue = [{ x, y }];
        const processed = new Set();
        
        while (queue.length > 0) {
            const { x, y } = queue.shift();
            const key = `${x},${y}`;
            if (processed.has(key)) continue;
            processed.add(key);
            
            const neighbors = this.getNeighbors(x, y);
            for (const { x: nx, y: ny, cell: neighbor } of neighbors) {
                if (neighbor.collapsed) continue;
                
                const valid = neighbor.possibilities.filter((p) => {
                    const allowed = window.TERRAIN_TYPES[p].adjacent;
                    return this.getNeighbors(nx, ny).some(({ cell: nn }) => 
                        nn.collapsed ? allowed.includes(nn.terrain) : true
                    );
                });
                
                if (valid.length !== neighbor.possibilities.length) {
                    neighbor.possibilities = valid;
                    if (valid.length === 0) {
                        this.log(`Contradiction at (${nx}, ${ny})`);
                        return false;
                    }
                    queue.push({ x: nx, y: ny });
                }
            }
        }
        return true;
    }

    step() {
        if (this.isComplete()) return false;
        const cell = this.findLowestEntropy();
        if (!cell) return false;
        
        if (this.collapseCell(cell.x, cell.y)) {
            if (!this.propagate(cell.x, cell.y)) {
                this.log("Contradiction!");
                return false;
            }
            this.stepCount++;
            return true;
        }
        return false;
    }

    isComplete() {
        return this.grid.flat().every((c) => c.collapsed);
    }

    placeLocations() {
        const cells = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (!this.grid[y][x].location) {
                    cells.push({ x, y });
                }
            }
        }

        const sortedLocations = [...window.LOCATIONS].sort((a, b) => {
            const countValid = (loc) => cells.filter((pos) => 
                this.isValidLocationSpot(pos.x, pos.y, loc)
            ).length;
            return countValid(a) - countValid(b);
        });

        for (const loc of sortedLocations) {
            const validSpots = cells.filter((pos) => this.isValidLocationSpot(pos.x, pos.y, loc));
            if (validSpots.length === 0) continue;
            
            const pick = validSpots[Math.floor(Math.random() * validSpots.length)];
            const { x, y } = pick;
            this.grid[y][x].location = loc;
            this.placedLocations.push({ x, y, loc });
            this.locationCount++;
            this.log(`📍 Placed ${loc.name || loc.label} at (${x}, ${y})`);
            
            const idx = cells.findIndex((c) => c.x === x && c.y === y);
            if (idx !== -1) cells.splice(idx, 1);
        }
    }

    isValidLocationSpot(x, y, location) {
        const cell = this.grid[y][x];
        if (cell.location) return false;
        
        const terrain = cell.terrain;
        const rules = location.rules;

        if (rules.on && !rules.on.includes(terrain)) return false;

        if (rules.adjacent && rules.adjacent.length > 0) {
            const neighborTerrains = this.getNeighbors(x, y)
                .filter((n) => n.cell.collapsed)
                .map((n) => n.cell.terrain);
            const hasAllRequired = rules.adjacent.every((req) => 
                neighborTerrains.includes(req)
            );
            if (!hasAllRequired) return false;
        }

        const tooClose = this.placedLocations.some((p) => 
            Math.abs(x - p.x) + Math.abs(y - p.y) < 3
        );
        if (tooClose) return false;

        return true;
    }

    async autoGenerate() {
        if (this.isGenerating) return;

        this.mapName = window.MapNamer.generate(this);
        const seedValue = window.MapNamer.stringToSeed(this.mapName);
        Math.seedrandom?.(seedValue);

        this.isGenerating = true;
        this.init();
        TemplatePlacer.applyTo(this, window.TEMPLATES);

        let attempts = 0;
        const max = this.width * this.height * 2;

        while (!this.isComplete() && attempts < max && this.isGenerating) {
            if (!this.step()) {
                this.log("Restarting due to contradiction...");
                this.init();
                TemplatePlacer.applyTo(this, window.TEMPLATES);
                attempts = 0;
            } else {
                attempts++;
            }
            await this.sleep(this.autoSpeed);
        }

        if (this.isComplete() && this.isGenerating) {
            this.placeLocations();
            const finalName = window.MapNamer.generate(this);
            this.mapName = finalName;
            this.log(`🌍 Final Name: "${finalName}"`);
            this.log("🎉 Complete with locations!");

            // Create parchment overlay if available
            if (typeof ParchmentOverlay !== "undefined") {
                this.parchment = new ParchmentOverlay(this.width, this.height, this.themeName, seedValue);
                this.parchment.initFromTheme(window.ThemeManager.current);
                this.parchment.setMapData(this.grid);
            }
        }

        this.isGenerating = false;
        return this.isComplete();
    }

    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    log(message) {
        console.log(`[WFC] ${message}`);
    }
}

// Export for module use
if (typeof window !== 'undefined') {
    window.TemplatePlacer = TemplatePlacer;
    window.WaveFunctionCollapse = WaveFunctionCollapse;
}

export { TemplatePlacer, WaveFunctionCollapse };