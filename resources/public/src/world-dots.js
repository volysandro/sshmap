// World continent dots — generated from coarse landmass polygons.
// Each polygon is [[lng,lat], ...]. We scatter dots inside at a given lat/lng step,
// then test each candidate point against polygons with point-in-polygon.
// This gives a recognizable dotted-continent world without external assets.

(function () {
  // Coarse continent polygons (approximate silhouettes). Coords are [lng, lat].
  // Not cartographically precise — tuned to read as familiar continents at small sizes.
  const CONTINENTS = [
    // --- North America ---
    [[-168,66],[-156,71],[-140,70],[-128,70],[-110,72],[-95,74],[-80,74],[-66,60],[-55,52],[-60,47],[-67,44],[-70,41],[-74,40],[-76,37],[-80,32],[-81,25],[-90,30],[-97,26],[-107,23],[-110,23],[-117,32],[-124,40],[-125,48],[-132,56],[-152,58],[-165,60]],
    // Central America
    [[-98,18],[-92,17],[-85,15],[-78,9],[-82,8],[-88,14],[-95,16]],
    // --- South America ---
    [[-81,12],[-76,11],[-70,12],[-60,10],[-52,5],[-48,-1],[-40,-6],[-35,-9],[-38,-18],[-42,-23],[-48,-28],[-56,-35],[-64,-41],[-68,-50],[-72,-54],[-75,-50],[-72,-42],[-72,-30],[-70,-20],[-75,-14],[-79,-6],[-80,0],[-82,6]],
    // --- Europe ---
    [[-10,36],[-5,36],[3,43],[9,43],[12,38],[17,40],[23,38],[27,37],[30,40],[28,45],[34,46],[40,48],[50,50],[55,55],[60,60],[55,66],[40,68],[30,70],[18,70],[8,64],[5,60],[-3,58],[-5,54],[-10,52],[-10,44]],
    // UK/Ireland
    [[-8,50],[-2,50],[0,53],[-2,58],[-5,58],[-8,55]],
    // Scandinavia
    [[5,58],[12,56],[18,60],[25,65],[28,70],[20,70],[14,67],[8,62]],
    // --- Africa ---
    [[-17,20],[-13,27],[-6,34],[2,36],[10,34],[18,32],[25,32],[33,31],[35,24],[43,12],[51,11],[51,2],[42,-1],[40,-10],[41,-16],[36,-22],[32,-28],[25,-34],[18,-34],[14,-28],[12,-17],[9,-2],[7,4],[-2,5],[-8,7],[-13,12],[-17,15]],
    // Madagascar
    [[43,-12],[50,-15],[50,-25],[45,-25]],
    // --- Asia ---
    [[30,40],[38,40],[45,40],[52,40],[55,38],[58,30],[50,25],[45,20],[55,12],[60,22],[68,25],[72,8],[78,7],[80,12],[82,18],[88,22],[92,22],[95,15],[100,14],[104,10],[108,11],[110,20],[117,22],[120,32],[122,38],[128,38],[130,33],[135,35],[140,40],[142,45],[140,52],[155,58],[170,65],[178,68],[180,70],[170,72],[140,74],[120,74],[100,78],[80,76],[60,72],[50,68],[40,66],[35,58],[30,50]],
    // Japan
    [[130,32],[136,34],[140,38],[142,42],[145,44],[142,41],[138,36],[132,33]],
    // Indonesia / SE Asia islands
    [[95,2],[103,2],[108,-2],[115,-4],[120,-3],[125,-1],[130,-3],[135,-4],[140,-3],[140,0],[130,1],[120,0],[110,2],[100,4]],
    // Philippines
    [[120,8],[124,12],[126,16],[122,18],[120,14],[119,10]],
    // --- Australia ---
    [[114,-22],[122,-18],[130,-12],[138,-14],[142,-11],[146,-18],[150,-25],[153,-28],[149,-37],[143,-39],[135,-35],[125,-33],[116,-35],[114,-28]],
    // NZ
    [[166,-46],[170,-41],[174,-41],[178,-38],[176,-42],[172,-46],[168,-47]],
    // --- Greenland ---
    [[-55,83],[-30,83],[-20,78],[-25,70],[-42,60],[-50,65],[-55,72]],
    // --- Antarctica (partial strip) ---
    [[-180,-70],[-140,-72],[-100,-73],[-60,-75],[-20,-72],[20,-70],[60,-68],[100,-66],[140,-67],[180,-70],[180,-78],[-180,-78]]
  ];

  function pointInPoly(pt, poly) {
    let inside = false;
    const x = pt[0], y = pt[1];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1];
      const xj = poly[j][0], yj = poly[j][1];
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function isLand(lng, lat) {
    for (let i = 0; i < CONTINENTS.length; i++) {
      if (pointInPoly([lng, lat], CONTINENTS[i])) return true;
    }
    return false;
  }

  // Generate dots on a lat/lng grid. Step in degrees.
  function generateDots(step = 2.5) {
    const dots = [];
    for (let lat = -78; lat <= 82; lat += step) {
      // Vary lng step by cos(lat) so density stays roughly uniform on sphere
      const lngStep = step / Math.max(0.2, Math.cos(lat * Math.PI / 180));
      for (let lng = -180; lng <= 180; lng += lngStep) {
        if (isLand(lng, lat)) {
          dots.push([lng, lat]);
        }
      }
    }
    return dots;
  }

  // Cache results at multiple densities
  const CACHE = {};
  function getDots(density = "medium") {
    if (CACHE[density]) return CACHE[density];
    const step = density === "dense" ? 1.6 : density === "sparse" ? 3.5 : 2.3;
    CACHE[density] = generateDots(step);
    return CACHE[density];
  }

  window.WorldDots = { getDots, isLand };
})();
