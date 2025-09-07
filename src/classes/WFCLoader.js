// src/classes/WFCLoader.js
// Integration module that loads WFC classes and creates fantasy theme data

export class WFCLoader {
  static async loadWFCClasses() {
    // Load WFC theme data for fantasy
    const fantasyTheme = {
      name: "Fantasy",
      description: "A quiet journey through enchanted lands",
      elevation: {
        spire: {
          label: "Ancient Peaks",
          colors: ["#777777", "#4B5563", "#6B7280"],
          weight: 12,
          adjacent: ["forest", "barrens"]
        },
        forest: {
          label: "Whispering Woods", 
          colors: ["#16A34A", "#15803D", "#166534"],
          weight: 30,
          adjacent: ["forest", "meadow", "spire"]
        },
        meadow: {
          label: "Sunlit Glades",
          colors: ["#A3E635", "#84CC16", "#65A30D"], 
          weight: 20,
          adjacent: ["meadow", "forest", "water"]
        },
        water: {
          label: "Glass Rivers",
          colors: ["#1D4ED8", "#2563EB", "#3B82F6"],
          weight: 18,
          adjacent: ["water", "meadow", "barrens"]
        },
        barrens: {
          label: "Cursed Lands",
          colors: ["#7C2D12", "#9A3412", "#C2410C"],
          weight: 1,
          adjacent: ["meadow"]
        }
      },
      locations: {
        cottage: { label: "Hermit's Cottage", emoji: "🏠", rules: { on: ["forest"], adjacent: ["meadow"] } },
        peak: { label: "Dragon's Perch", emoji: "🐉", rules: { on: ["spire"] } },
        sanctum: { label: "Crystal Sanctum", emoji: "🔮", rules: { on: ["spire"], adjacent: ["barrens"] } },
        ruins: { label: "Fallen Temple", emoji: "🏛️", rules: { on: ["barrens"], adjacent: ["forest"] } },
        lighthouse: { label: "Castle Craig", emoji: "🏰", rules: { on: ["meadow"], adjacent: ["water"] } },
        wharf: { label: "River Wharf", emoji: "⚓", rules: { on: ["meadow"], adjacent: ["water"] } },
        crossroads: { label: "Fae Crossroads", emoji: "🏘️", rules: { on: ["forest"], adjacent: ["meadow", "spire"] } },
        mines: { label: "Gem Caverns", emoji: "💎", rules: { on: ["spire"], adjacent: ["forest"] } },
        grove: { label: "Sacred Grove", emoji: "🌳", rules: { on: ["forest"] } },
        ford: { label: "Stone Ford", emoji: "🪨", rules: { on: ["meadow"], adjacent: ["spire"] } }
      },
      templates: {
        river_flow: {
          weight: 4,
          placement: "any",
          pattern: [
            [null, "meadow", "water", "meadow", null],
            [null, "meadow", "water", "meadow", null],
            ["forest", "forest", "water", "forest", "forest"],
            ["forest", "forest", "water", "forest", "forest"],
            [null, "meadow", "water", "meadow", null]
          ]
        },
        mountain_heart: {
          weight: 2,
          placement: "center", 
          pattern: [
            ["spire", "spire", "spire"],
            ["spire", "spire", "spire"],
            ["forest", "forest", "barrens"]
          ]
        }
      }
    };

    // Set up global WFC data
    window.TERRAIN_TYPES = {};
    Object.keys(fantasyTheme.elevation).forEach((type) => {
      window.TERRAIN_TYPES[type] = {
        weight: fantasyTheme.elevation[type].weight || 1,
        adjacent: fantasyTheme.elevation[type].adjacent || [],
        colors: fantasyTheme.elevation[type].colors || ["#333"],
      };
    });

    window.LOCATIONS = Object.entries(fantasyTheme.locations).map(([id, loc]) => ({
      id,
      ...loc,
    }));

    window.TEMPLATES = fantasyTheme.templates || {};
    window.THEME = fantasyTheme;

    return { TERRAIN_TYPES: window.TERRAIN_TYPES, LOCATIONS: window.LOCATIONS, TEMPLATES: window.TEMPLATES, THEME: fantasyTheme };
  }

  static initThemeManager() {
    // Create minimal ThemeManager for WFC integration
    window.ThemeManager = {
      themes: { fantasy: window.THEME },
      current: window.THEME,
      
      setTheme(themeName) {
        if (this.themes[themeName]) {
          this.current = this.themes[themeName];
        }
      },

      getRandomColor(colors) {
        if (!colors || colors.length === 0) return "#333";
        return colors[Math.floor(Math.random() * colors.length)];
      }
    };
  }

  static setupMapNamer() {
    // Simplified MapNamer for trading sim
    window.MapNamer = {
      generate(wfc) {
        const grid = wfc.grid.flat();
        const terrainCount = {};
        const placedLocations = wfc.placedLocations;

        grid.forEach(cell => {
          if (cell.terrain) terrainCount[cell.terrain] = (terrainCount[cell.terrain] || 0) + 1;
        });

        let dominantTerrain;
        const terrainKeys = Object.keys(terrainCount);
        if (terrainKeys.length > 0) {
          dominantTerrain = terrainKeys.reduce((a, b) =>
            terrainCount[a] > terrainCount[b] ? a : b
          );
        } else {
          dominantTerrain = Object.keys(window.TERRAIN_TYPES)[0] || "meadow";
        }

        const themeData = window.ThemeManager.current;
        const terrainLabel = themeData.elevation[dominantTerrain]?.label || "Unknown";

        const iconicLocation = placedLocations.length > 0
          ? placedLocations.sort((a, b) => {
              const aWeight = window.TERRAIN_TYPES[a.loc.id]?.weight || 1;
              const bWeight = window.TERRAIN_TYPES[b.loc.id]?.weight || 1;
              return aWeight - bWeight;
            })[0]?.loc.name
          : null;

        const adjectives = ["Sacred", "Ancient", "Whispering", "Cursed", "Hidden", "Eternal", "Forgotten"];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];

        const patterns = [
          `${adj} ${terrainLabel}`,
          `${iconicLocation ? iconicLocation : `The ${adj} Site`} in the ${terrainLabel}`,
          `${iconicLocation ? `${iconicLocation} of` : `The ${adj} Realm of`} the ${terrainLabel}`,
          `The ${adj} ${iconicLocation || "Place"} by the ${terrainLabel}`,
          `Where the ${terrainLabel} Begins`
        ];

        return patterns[Math.floor(Math.random() * patterns.length)];
      },

      stringToSeed(str) {
        let seed = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          seed = ((seed << 5) - seed + char) & 0xffffffff;
        }
        return Math.abs(seed) % 1000000;
      }
    };
  }

  static async initialize() {
    const data = await this.loadWFCClasses();
    this.initThemeManager();
    this.setupMapNamer();
    return data;
  }
}