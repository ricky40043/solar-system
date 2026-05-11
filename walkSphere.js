// 球面行星漫遊模組
// 玩家在真實球面上移動，up 向量永遠指向球心外，可無限繞行
window.PlanetWalkSphere = (function () {
  'use strict';

  const DEFAULT_R = 250;                       // 球半徑（單位）
  const EYE       = 1.8;                       // 玩家眼高
  const SENS_H    = 0.003;
  const SENS_V    = 0.003;
  const EARTH_ASSET_PATHS = {
    day: 'assets/earth/earth_day_4096.jpg',
    bump: 'assets/earth/earth_bump_roughness_clouds_4096.jpg',
    normal: 'assets/earth/earth_normal_2048.jpg',
    specular: 'assets/earth/earth_specular_2048.jpg',
  };

  const PLANETS = {
    mercury: { name: '水星', color: 0x8a7a68, atmo: 0x111111, ambient: 0xffffff, ambientI: 0.18, sun: 0xffffff, sunI: 4.0, walkSpeed: 8, terrain: 0.55, radius: DEFAULT_R, segW: 256, segH: 128 },
    venus:   { name: '金星', color: 0xc07028, atmo: 0xd88430, ambient: 0xffb070, ambientI: 0.85, sun: 0xffcc80, sunI: 0.45, walkSpeed: 8, terrain: 0.75, radius: DEFAULT_R, segW: 256, segH: 128 },
    earth:   { name: '地球', color: 0x3366bb, atmo: 0x3366bb, ambient: 0xffffff, ambientI: 0.46, sun: 0xfff5e0, sunI: 1.55, walkSpeed: 18, terrain: 1.0, radius: 900, segW: 384, segH: 192 },
    mars:    { name: '火星', color: 0xb65a35, atmo: 0xd09070, ambient: 0xffd0a8, ambientI: 0.50, sun: 0xffe0b8, sunI: 1.0, walkSpeed: 8, terrain: 0.9, radius: DEFAULT_R, segW: 256, segH: 128 },
    jupiter: { name: '木星', color: 0xd0a070, atmo: 0xe8b878, ambient: 0xffd8a8, ambientI: 0.65, sun: 0xfff0d8, sunI: 0.65, walkSpeed: 10, terrain: 0.25, radius: DEFAULT_R, segW: 256, segH: 128 },
    saturn:  { name: '土星', color: 0xd8bc82, atmo: 0xf0d8a0, ambient: 0xfff0d0, ambientI: 0.65, sun: 0xfff0d8, sunI: 0.50, walkSpeed: 10, terrain: 0.25, radius: DEFAULT_R, segW: 256, segH: 128 },
    uranus:  { name: '天王星', color: 0x70c8d8, atmo: 0x80d8f0, ambient: 0xa0e8f8, ambientI: 0.55, sun: 0xe0f0ff, sunI: 0.15, walkSpeed: 8, terrain: 0.35, radius: DEFAULT_R, segW: 256, segH: 128 },
    neptune: { name: '海王星', color: 0x2448c8, atmo: 0x4060d0, ambient: 0x5060d0, ambientI: 0.45, sun: 0x8090ff, sunI: 0.12, walkSpeed: 8, terrain: 0.45, radius: DEFAULT_R, segW: 256, segH: 128 },
  };

  // ——— 狀態 ———
  let scene, camera, renderer, container, canvasEl, animId;
  let planetKey = 'earth', cfg = PLANETS.earth;
  let planetRadius = cfg.radius;
  let playerDir = new THREE.Vector3(1, 0, 0);
  let headingDir = new THREE.Vector3(0, 1, 0);
  let pitchAngle = -0.08; // 稍微朝下，看到地平線曲線
  let isFlying = false, flyAlt = 60, flySpeed = 30;
  let keys = {}, isPointerDown = false, lastPtr = { x: 0, y: 0 };
  let onModeChangeCb = null, lastTime = 0;
  let earthAssets = null, initToken = 0;

  function latLonFromDir(dir) {
    return {
      lat: Math.asin(Math.max(-1, Math.min(1, dir.y))),
      lon: Math.atan2(dir.z, dir.x),
    };
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function smoothstep(edge0, edge1, x) {
    const t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }

  function lonDelta(a, b) {
    let d = a - b;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  }

  function ellipseMask(latDeg, lonDeg, cx, cy, rx, ry, rotDeg = 0) {
    const rot = rotDeg * Math.PI / 180;
    const dx = lonDelta(lonDeg, cx) * Math.cos(latDeg * Math.PI / 180);
    const dy = latDeg - cy;
    const x = dx * Math.cos(rot) - dy * Math.sin(rot);
    const y = dx * Math.sin(rot) + dy * Math.cos(rot);
    const d = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2);
    return 1 - smoothstep(0.86, 1.08, d);
  }

  function ridgeMask(latDeg, lonDeg, cx, cy, rx, ry, rotDeg = 0) {
    return ellipseMask(latDeg, lonDeg, cx, cy, rx, ry, rotDeg);
  }

  function earthInfoFromLL(lat, lon) {
    const latDeg = lat * 180 / Math.PI;
    const lonDeg = lon * 180 / Math.PI;
    let land = 0;
    let continent = null;

    function add(mask, name) {
      if (mask > land) {
        land = mask;
        continent = name;
      }
    }

    add(Math.max(
      ellipseMask(latDeg, lonDeg, -103, 48, 46, 27, -12),
      ellipseMask(latDeg, lonDeg, -88, 20, 26, 10, -20),
      ellipseMask(latDeg, lonDeg, -42, 73, 18, 10, -20)
    ), 'northAmerica');
    add(ellipseMask(latDeg, lonDeg, -61, -18, 19, 38, -12), 'southAmerica');
    add(Math.max(
      ellipseMask(latDeg, lonDeg, 13, 51, 25, 13, 8),
      ellipseMask(latDeg, lonDeg, 34, 39, 18, 11, 15)
    ), 'europe');
    add(ellipseMask(latDeg, lonDeg, 20, 2, 25, 36, -6), 'africa');
    add(Math.max(
      ellipseMask(latDeg, lonDeg, 82, 45, 68, 26, 4),
      ellipseMask(latDeg, lonDeg, 76, 20, 12, 15, -12),
      ellipseMask(latDeg, lonDeg, 106, 12, 23, 12, -8)
    ), 'asia');
    add(ellipseMask(latDeg, lonDeg, 134, -25, 21, 12, 5), 'australia');

    const antarcticEdge = -63 - 4 * Math.sin((lonDeg + 35) * Math.PI / 45);
    add(smoothstep(antarcticEdge + 3, antarcticEdge - 5, latDeg), 'antarctica');

    const ice = Math.max(
      smoothstep(61, 76, Math.abs(latDeg)),
      continent === 'antarctica' ? 1 : 0,
      ellipseMask(latDeg, lonDeg, -42, 73, 18, 10, -20) * 0.75
    );
    const desert = Math.max(
      ridgeMask(latDeg, lonDeg, 15, 23, 25, 9, -5),
      ridgeMask(latDeg, lonDeg, 45, 24, 22, 8, 10),
      ridgeMask(latDeg, lonDeg, 135, -25, 18, 9, 0),
      ridgeMask(latDeg, lonDeg, -112, 36, 15, 8, 15),
      ridgeMask(latDeg, lonDeg, 17, -23, 13, 8, 5)
    ) * land;
    const rainforest = Math.max(
      ridgeMask(latDeg, lonDeg, -62, -5, 18, 12, -10),
      ridgeMask(latDeg, lonDeg, 22, 0, 20, 10, -8),
      ridgeMask(latDeg, lonDeg, 108, 1, 17, 9, -8)
    ) * land;
    const mountains = Math.max(
      ridgeMask(latDeg, lonDeg, -72, -20, 6, 34, -8),
      ridgeMask(latDeg, lonDeg, -112, 47, 8, 28, -12),
      ridgeMask(latDeg, lonDeg, 86, 31, 28, 7, 5),
      ridgeMask(latDeg, lonDeg, 72, 39, 28, 6, -8),
      ridgeMask(latDeg, lonDeg, 12, 46, 16, 4, 5),
      ridgeMask(latDeg, lonDeg, 38, -4, 11, 15, 5)
    ) * land;
    const coast = land > 0.08 && land < 0.72 ? 1 - Math.abs(land - 0.40) / 0.40 : 0;

    return { latDeg, lonDeg, land, continent, ice, desert, rainforest, mountains, coast: clamp01(coast) };
  }

  function earthInfoN(nx, ny, nz) {
    const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
    const lon = Math.atan2(nz, nx);
    return earthInfoFromLL(lat, lon);
  }

  function configureTexture(tex) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
    tex.needsUpdate = true;
    return tex;
  }

  function loadTexture(src) {
    return new Promise((resolve) => {
      new THREE.TextureLoader().load(
        src,
        (tex) => resolve(configureTexture(tex)),
        undefined,
        () => resolve(null)
      );
    });
  }

  function loadImageData(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve({
          width: canvas.width,
          height: canvas.height,
          data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        });
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function preloadEarthAssets() {
    if (earthAssets) return Promise.resolve(earthAssets);
    return Promise.all([
      loadTexture(EARTH_ASSET_PATHS.day),
      loadTexture(EARTH_ASSET_PATHS.bump),
      loadTexture(EARTH_ASSET_PATHS.normal),
      loadTexture(EARTH_ASSET_PATHS.specular),
      loadImageData(EARTH_ASSET_PATHS.bump),
      loadImageData(EARTH_ASSET_PATHS.specular),
    ]).then(([dayMap, bumpMap, normalMap, specularMap, bumpData, specularData]) => {
      earthAssets = { dayMap, bumpMap, normalMap, specularMap, bumpData, specularData };
      return earthAssets;
    });
  }

  function sampleImage(dataSet, lat, lon, channel = null) {
    if (!dataSet) return null;
    const u = ((lon / (Math.PI * 2)) + 0.5 + 1) % 1;
    const v = clamp01(0.5 - lat / Math.PI);
    const x = Math.min(dataSet.width - 1, Math.max(0, Math.floor(u * dataSet.width)));
    const y = Math.min(dataSet.height - 1, Math.max(0, Math.floor(v * dataSet.height)));
    const i = (y * dataSet.width + x) * 4;
    if (channel !== null) return dataSet.data[i + channel] / 255;
    return (dataSet.data[i] + dataSet.data[i + 1] + dataSet.data[i + 2]) / (255 * 3);
  }

  function sampledEarthHeight(lat, lon) {
    if (!earthAssets || !earthAssets.bumpData) return null;
    const bump = sampleImage(earthAssets.bumpData, lat, lon, 0);
    const spec = sampleImage(earthAssets.specularData, lat, lon);
    if (bump === null) return null;
    const water = spec === null ? 0 : smoothstep(0.22, 0.68, spec);
    const rough = Math.max(0, bump - 0.08);
    if (water > 0.45) return -10 + bump * 3;
    return 1.5 + rough * 45;
  }

  // ——— 地形高度（正規化方向向量 → 高度）———
  function heightN(nx, ny, nz) {
    const la = Math.asin(Math.max(-1, Math.min(1, ny)));
    const lo = Math.atan2(nz, nx);
    if (planetKey === 'earth') {
      const sampled = sampledEarthHeight(la, lo);
      if (sampled !== null) return sampled;

      const e = earthInfoFromLL(la, lo);
      const detail = Math.sin(la * 21 + lo * 37) * 1.7
        + Math.sin(la * 61 - lo * 53) * 0.8
        + Math.sin(la * 117 + lo * 91) * 0.35;
      if (e.land < 0.18) {
        const oceanWave = Math.sin(la * 12 + lo * 19) * 0.7 + Math.sin(la * 34 - lo * 27) * 0.35;
        return -11 + e.land * 28 + oceanWave;
      }

      let h = 2 + e.land * 7 + detail;
      h += e.mountains * 26;
      h += e.desert * 4;
      h += e.rainforest * 3;
      h += e.ice * 8;
      h += e.coast * 1.5;
      return h;
    }

    let h = 0;
    h += Math.sin(la * 3  + lo * 5)  * 14;
    h += Math.sin(la * 7  - lo * 11) * 9;
    h += Math.sin(la * 13 + lo * 17) * 5;
    h += Math.sin(la * 31 - lo * 43) * 2.5;
    h += Math.sin(la * 71 + lo * 83) * 1.2;
    return Math.max(-6, h * cfg.terrain);
  }

  function heightLL(la, lo) {
    return heightN(
      Math.cos(la) * Math.cos(lo),
      Math.sin(la),
      Math.cos(la) * Math.sin(lo)
    );
  }

  // ——— 頂點顏色 ———
  function colorH(h) {
    if (planetKey === 'mercury') {
      if (h <= -2) return [0.34, 0.30, 0.26];
      if (h <=  6) return [0.48, 0.42, 0.35];
      return [0.66, 0.60, 0.52];
    }
    if (planetKey === 'venus') {
      if (h <=  0) return [0.38, 0.15, 0.05];
      if (h <= 10) return [0.72, 0.34, 0.10];
      return [0.95, 0.58, 0.22];
    }
    if (planetKey === 'mars') {
      if (h <= -2) return [0.48, 0.20, 0.10];
      if (h <= 10) return [0.70, 0.32, 0.17];
      return [0.86, 0.52, 0.32];
    }
    if (planetKey === 'jupiter' || planetKey === 'saturn') {
      const band = Math.sin(h * 0.35 + planetKey.length);
      return band > 0 ? [0.86, 0.70, 0.48] : [0.64, 0.44, 0.28];
    }
    if (planetKey === 'uranus') {
      if (h <= 0) return [0.28, 0.62, 0.70];
      return [0.58, 0.86, 0.92];
    }
    if (planetKey === 'neptune') {
      if (h <= 0) return [0.04, 0.12, 0.34];
      return [0.12, 0.26, 0.70];
    }
    if (h <= -2) return [0.10, 0.22, 0.55];
    if (h <=  0) return [0.16, 0.38, 0.70];
    if (h <=  2) return [0.76, 0.72, 0.50];
    if (h <=  9) return [0.26, 0.55, 0.20];
    if (h <= 17) return [0.20, 0.40, 0.16];
    if (h <= 24) return [0.50, 0.44, 0.38];
    return [0.90, 0.90, 0.92];
  }

  function earthColor(info, h) {
    if (info.land < 0.18) {
      if (info.land > 0.08) return [0.07, 0.36, 0.62];
      return h < -10 ? [0.03, 0.13, 0.36] : [0.04, 0.23, 0.52];
    }
    if (info.coast > 0.35) return [0.77, 0.71, 0.48];
    if (info.ice > 0.55) return [0.88, 0.91, 0.90];
    if (info.mountains > 0.50 && h > 25) return [0.74, 0.72, 0.67];
    if (info.mountains > 0.35) return [0.42, 0.38, 0.31];
    if (info.desert > 0.45) return [0.76, 0.58, 0.30];
    if (info.rainforest > 0.35) return [0.06, 0.31, 0.12];
    if (info.continent === 'australia') return [0.63, 0.42, 0.22];
    if (Math.abs(info.latDeg) > 48) return [0.22, 0.46, 0.20];
    return [0.18, 0.50, 0.18];
  }

  function colorN(nx, ny, nz, h) {
    if (planetKey === 'earth') return earthColor(earthInfoN(nx, ny, nz), h);
    return colorH(h);
  }

  // ——— 建立球面地形 Mesh ———
  function buildTerrain() {
    const geo = new THREE.SphereGeometry(planetRadius, cfg.segW, cfg.segH);
    const pos = geo.attributes.position;
    const cols = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const nx = x / len, ny = y / len, nz = z / len;
      const h = heightN(nx, ny, nz);
      const r = planetRadius + h;
      pos.setXYZ(i, nx * r, ny * r, nz * r);
      const [cr, cg, cb] = colorN(nx, ny, nz, h);
      cols.push(cr, cg, cb);
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const mat = planetKey === 'earth' && earthAssets && earthAssets.dayMap
      ? new THREE.MeshPhongMaterial({
          map: earthAssets.dayMap,
          bumpMap: earthAssets.bumpMap || null,
          bumpScale: 7,
          normalMap: earthAssets.normalMap || null,
          specularMap: earthAssets.specularMap || null,
          specular: new THREE.Color(0x335577),
          shininess: 18,
          side: THREE.FrontSide,
        })
      : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide });

    return new THREE.Mesh(geo, mat);
  }

  // ——— 大氣光暈（薄圈）———
  function buildAtmo() {
    const geo = new THREE.SphereGeometry(planetRadius + planetRadius * 0.12, 48, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: cfg.atmo, transparent: true, opacity: 0.10,
      side: THREE.BackSide, depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
  }

  // ——— 星空 ———
  function buildStars() {
    const n = 3000, verts = [];
    const SR = planetRadius * 50;
    for (let i = 0; i < n; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      verts.push(
        SR * Math.sin(phi) * Math.cos(theta),
        SR * Math.cos(phi),
        SR * Math.sin(phi) * Math.sin(theta)
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.0 }));
  }

  // ——— 玩家 3D 位置 ———
  function getPlayerPos() {
    const h = heightN(playerDir.x, playerDir.y, playerDir.z);
    const groundR = planetRadius + h;
    const r = isFlying ? planetRadius + flyAlt : groundR + EYE;
    return playerDir.clone().multiplyScalar(r);
  }

  function getUp() {
    return playerDir.clone().normalize();
  }

  function getNorth() {
    const ll = latLonFromDir(playerDir);
    return new THREE.Vector3(
      -Math.sin(ll.lat) * Math.cos(ll.lon),
       Math.cos(ll.lat),
      -Math.sin(ll.lat) * Math.sin(ll.lon)
    ).normalize();
  }

  function getEast() {
    const lon = latLonFromDir(playerDir).lon;
    return new THREE.Vector3(-Math.sin(lon), 0, Math.cos(lon)).normalize();
  }

  function headingAngle() {
    const north = getNorth();
    const east = getEast();
    return Math.atan2(headingDir.dot(east), headingDir.dot(north));
  }

  function normalizeHeading(fallback) {
    headingDir.addScaledVector(playerDir, -headingDir.dot(playerDir));
    if (headingDir.lengthSq() < 1e-8) {
      headingDir.copy(fallback || getNorth());
      headingDir.addScaledVector(playerDir, -headingDir.dot(playerDir));
    }
    headingDir.normalize();
  }

  function stepOnSphere(dir, distance) {
    if (distance <= 0 || dir.lengthSq() < 1e-8) return;
    const oldHeading = headingDir.clone();
    const moveDir = dir.clone().addScaledVector(playerDir, -dir.dot(playerDir));
    if (moveDir.lengthSq() < 1e-8) return;
    moveDir.normalize();

    const angle = distance / planetRadius;
    const nextDir = playerDir.clone()
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(moveDir, Math.sin(angle))
      .normalize();

    playerDir.copy(nextDir);
    headingDir.copy(oldHeading);
    normalizeHeading(moveDir);
  }

  // ——— 更新相機 ———
  function updateCamera() {
    const pos   = getPlayerPos();
    const up    = getUp();
    const hFwd = headingDir.clone().normalize();

    const forward = new THREE.Vector3()
      .addScaledVector(hFwd, Math.cos(pitchAngle))
      .addScaledVector(up,   Math.sin(pitchAngle))
      .normalize();

    const right  = new THREE.Vector3().crossVectors(hFwd, up).normalize();
    const camUp  = new THREE.Vector3().crossVectors(right, forward).normalize();

    camera.position.copy(pos);
    camera.up.copy(camUp);
    camera.lookAt(pos.clone().add(forward));
  }

  // ——— 玩家移動 ———
  function movePlayer(dt) {
    const spd = isFlying ? flySpeed : cfg.walkSpeed;
    const right = new THREE.Vector3().crossVectors(headingDir, playerDir).normalize();
    const move = new THREE.Vector3();

    if (keys['w'] || keys['arrowup'])    move.add(headingDir);
    if (keys['s'] || keys['arrowdown'])  move.sub(headingDir);
    if (keys['a'] || keys['arrowleft'])  move.sub(right);
    if (keys['d'] || keys['arrowright']) move.add(right);
    if (move.lengthSq() > 0) stepOnSphere(move.normalize(), spd * dt);

    // 飛行模式上下
    if (isFlying) {
      if (keys[' '])     flyAlt += flySpeed * dt * 0.5;
      if (keys['shift']) flyAlt = Math.max(5, flyAlt - flySpeed * dt * 0.5);
    }
  }

  // ——— 事件處理 ———
  function onPtrDown(e) {
    isPointerDown = true;
    lastPtr = { x: e.clientX, y: e.clientY };
  }
  function onPtrMove(e) {
    if (!isPointerDown) return;
    const dx = e.clientX - lastPtr.x;
    const dy = e.clientY - lastPtr.y;
    lastPtr = { x: e.clientX, y: e.clientY };
    headingDir.applyAxisAngle(playerDir, -dx * SENS_H);
    normalizeHeading();
    // 最多往下看 40°，避免看進自己腳下造成渦旋效果
    pitchAngle  = Math.max(-Math.PI / 4.5, Math.min(Math.PI / 6, pitchAngle - dy * SENS_V));
  }
  function onPtrUp() { isPointerDown = false; }

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (e.key === ' ') e.preventDefault();
    if (k === 'f') {
      isFlying = !isFlying;
      if (isFlying) { flyAlt = 60; }
      if (onModeChangeCb) onModeChangeCb(isFlying);
    }
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }

  function onResize() {
    if (!renderer || !camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  function bindEvents() {
    canvasEl.addEventListener('pointerdown',  onPtrDown);
    canvasEl.addEventListener('pointermove',  onPtrMove);
    canvasEl.addEventListener('pointerup',    onPtrUp);
    canvasEl.addEventListener('pointerleave', onPtrUp);
    window.addEventListener('keydown',  onKeyDown);
    window.addEventListener('keyup',    onKeyUp);
    window.addEventListener('resize',   onResize);
  }
  function unbindEvents() {
    if (canvasEl) {
      canvasEl.removeEventListener('pointerdown',  onPtrDown);
      canvasEl.removeEventListener('pointermove',  onPtrMove);
      canvasEl.removeEventListener('pointerup',    onPtrUp);
      canvasEl.removeEventListener('pointerleave', onPtrUp);
    }
    window.removeEventListener('keydown',  onKeyDown);
    window.removeEventListener('keyup',    onKeyUp);
    window.removeEventListener('resize',   onResize);
  }

  // ——— 渲染迴圈 ———
  function loop(now) {
    animId = requestAnimationFrame(loop);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    movePlayer(dt);
    updateCamera();
    renderer.render(scene, camera);
    // 更新 HUD
    if (window.updateWalkHUD) {
      const ll = latLonFromDir(playerDir);
      window.updateWalkHUD({
        x: ll.lon * 100, z: -ll.lat * 100,
        elevation: heightLL(ll.lat, ll.lon),
        altitude: isFlying ? flyAlt : 0,
        yaw: headingAngle(),
        planetKey,
        flyMode: isFlying,
        flySpeed,
        sphereMode: true,
        lat: ll.lat * 180 / Math.PI,
        lon: ll.lon * 180 / Math.PI,
      });
    }
  }

  // ——— 初始化 ———
  function init(containerEl, key) {
    const token = ++initToken;
    container = containerEl;
    planetKey = PLANETS[key] ? key : 'earth';
    cfg = PLANETS[planetKey];
    planetRadius = cfg.radius || DEFAULT_R;
    playerDir.set(1, 0, 0);
    headingDir.set(0, 1, 0);
    pitchAngle = 0.02; // 略微朝上，讓地平線在視野中央
    isFlying = false; flyAlt = 60; flySpeed = 30;
    keys = {}; isPointerDown = false;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.85;
    container.appendChild(renderer.domElement);
    canvasEl = renderer.domElement;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000008);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, planetRadius * 120);

    scene.add(new THREE.AmbientLight(cfg.ambient, cfg.ambientI));
    const sun = new THREE.DirectionalLight(cfg.sun, cfg.sunI);
    sun.position.set(planetRadius * 5, planetRadius * 2, planetRadius * 3);
    scene.add(sun);

    const finishInit = () => {
      if (token !== initToken || !scene) return;
      scene.add(buildTerrain());
      scene.add(buildAtmo());
      scene.add(buildStars());

      bindEvents();
      lastTime = performance.now();
      loop(lastTime);
    };

    if (planetKey === 'earth') {
      preloadEarthAssets().then(finishInit);
    } else {
      finishInit();
    }
  }

  function dispose() {
    initToken++;
    if (animId) cancelAnimationFrame(animId);
    unbindEvents();
    if (renderer) {
      renderer.dispose();
      if (canvasEl && canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl);
    }
    scene = camera = renderer = container = canvasEl = null;
    animId = null; keys = {};
  }

  return {
    init,
    dispose,
    setFlyMode:  (on) => {
      isFlying = on;
      if (on) flyAlt = 60;
      if (onModeChangeCb) onModeChangeCb(on);
    },
    setFlySpeed: (v)  => { flySpeed = v; },
    isFlying:    ()   => isFlying,
    getFlySpeed: ()   => flySpeed,
    onModeChange:(cb) => { onModeChangeCb = cb; },
  };
})();
