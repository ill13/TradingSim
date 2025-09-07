class DataLoader {
    static async load() {
        const [terrainRes, locationsRes] = await Promise.all([
            fetch('js/terrain.json'),
            fetch('js/locations.json')
        ]);

        const TERRAIN_TYPES = await terrainRes.json();
        const LOCATIONS = await locationsRes.json();

        return { TERRAIN_TYPES, LOCATIONS };
    }
}