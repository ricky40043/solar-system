// 球面行星漫遊模組 — 地球
// 玩家在真實球面上移動，up 向量永遠指向球心外，可無限繞行
window.PlanetWalkSphere = (function () {
  'use strict';

  const R         = 250;                       // 球半徑（單位）
  const SEG_W     = 256;                       // 經度切割數
  const SEG_H     = 128;                       // 緯度切割數
  const EYE       = 1.8;                       // 玩家眼高
  const ORBIT_SPD = (2 * Math.PI * R) / 60;   // 自動公轉速度（≈26.2 u/s，60秒繞一圈）
  const WALK_SPD  = 10;                        // 手動步行速度
  const SENS_H    = 0.003;
  const SENS_V    = 0.003;

  // ——— 狀態 ———
  let scene, camera, renderer, container, canvasEl, animId;
  let playerLat = 0.0, playerLon = 0.0;
  let heading = 0, pitchAngle = -0.08; // 稍微朝下，看到地平線曲線
  let isFlying = false, flyAlt = 60, flySpeed = 30;
  let autoOrbit = true;                // 預設開啟自動公轉
  let keys = {}, isPointerDown = false, lastPtr = { x: 0, y: 0 };
  let onModeChangeCb = null, lastTime = 0;

  // ——— 地形高度（正規化方向向量 → 高度）———
  function heightN(nx, ny, nz) {
    const la = Math.asin(Math.max(-1, Math.min(1, ny)));
    const lo = Math.atan2(nz, nx);
    let h = 0;
    h += Math.sin(la * 3  + lo * 5)  * 14;
    h += Math.sin(la * 7  - lo * 11) * 9;
    h += Math.sin(la * 13 + lo * 17) * 5;
    h += Math.sin(la * 31 - lo * 43) * 2.5;
    h += Math.sin(la * 71 + lo * 83) * 1.2;
    return Math.max(-6, h);
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
    if (h <= -2) return [0.10, 0.22, 0.55];
    if (h <=  0) return [0.16, 0.38, 0.70];
    if (h <=  2) return [0.76, 0.72, 0.50];
    if (h <=  9) return [0.26, 0.55, 0.20];
    if (h <= 17) return [0.20, 0.40, 0.16];
    if (h <= 24) return [0.50, 0.44, 0.38];
    return [0.90, 0.90, 0.92];
  }

  // ——— 建立球面地形 Mesh ———
  function buildTerrain() {
    const geo = new THREE.SphereGeometry(R, SEG_W, SEG_H);
    const pos = geo.attributes.position;
    const cols = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const nx = x / len, ny = y / len, nz = z / len;
      const h = heightN(nx, ny, nz);
      const r = R + h;
      pos.setXYZ(i, nx * r, ny * r, nz * r);
      const [cr, cg, cb] = colorH(h);
      cols.push(cr, cg, cb);
    }
    pos.needsUpdate = true;
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(
      geo,
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide })
    );
  }

  // ——— 大氣光暈（薄圈）———
  function buildAtmo() {
    const geo = new THREE.SphereGeometry(R + 30, 48, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3366bb, transparent: true, opacity: 0.10,
      side: THREE.BackSide, depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
  }

  // ——— 星空 ———
  function buildStars() {
    const n = 3000, verts = [];
    const SR = R * 50;
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
    const h = heightLL(playerLat, playerLon);
    const groundR = R + h;
    const r = isFlying ? R + flyAlt : groundR + EYE;
    const nx = Math.cos(playerLat) * Math.cos(playerLon);
    const ny = Math.sin(playerLat);
    const nz = Math.cos(playerLat) * Math.sin(playerLon);
    return new THREE.Vector3(nx * r, ny * r, nz * r);
  }

  function getUp() {
    return new THREE.Vector3(
      Math.cos(playerLat) * Math.cos(playerLon),
      Math.sin(playerLat),
      Math.cos(playerLat) * Math.sin(playerLon)
    ).normalize();
  }

  function getNorth() {
    return new THREE.Vector3(
      -Math.sin(playerLat) * Math.cos(playerLon),
       Math.cos(playerLat),
      -Math.sin(playerLat) * Math.sin(playerLon)
    ).normalize();
  }

  function getEast() {
    return new THREE.Vector3(-Math.sin(playerLon), 0, Math.cos(playerLon)).normalize();
  }

  // ——— 更新相機 ———
  function updateCamera() {
    const pos   = getPlayerPos();
    const up    = getUp();
    const north = getNorth();
    const east  = getEast();

    const hFwd = new THREE.Vector3()
      .addScaledVector(north, Math.cos(heading))
      .addScaledVector(east,  Math.sin(heading));

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
    const cosLa = Math.max(0.01, Math.cos(playerLat));

    // 自動公轉（沿 heading 方向前進）
    if (autoOrbit && !isFlying) {
      const da = ORBIT_SPD * dt / R;
      playerLat += da * Math.cos(heading);
      playerLon += da * Math.sin(heading) / cosLa;
    }

    // 手動 WASD（疊加在自動公轉上）
    const spd = isFlying ? flySpeed : WALK_SPD;
    const da  = spd * dt / R;
    const cl  = Math.max(0.01, Math.cos(playerLat));

    if (keys['w'] || keys['arrowup']) {
      playerLat += da * Math.cos(heading);
      playerLon += da * Math.sin(heading) / cl;
    }
    if (keys['s'] || keys['arrowdown']) {
      playerLat -= da * Math.cos(heading);
      playerLon -= da * Math.sin(heading) / cl;
    }
    if (keys['a'] || keys['arrowleft']) {
      playerLat -= da * Math.sin(heading);
      playerLon += da * Math.cos(heading) / cl;
    }
    if (keys['d'] || keys['arrowright']) {
      playerLat += da * Math.sin(heading);
      playerLon -= da * Math.cos(heading) / cl;
    }

    // 飛行模式上下
    if (isFlying) {
      if (keys[' '])     flyAlt += flySpeed * dt * 0.5;
      if (keys['shift']) flyAlt = Math.max(5, flyAlt - flySpeed * dt * 0.5);
    }

    playerLat = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, playerLat));
    while (playerLon >  Math.PI) playerLon -= Math.PI * 2;
    while (playerLon < -Math.PI) playerLon += Math.PI * 2;
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
    heading    += dx * SENS_H;
    pitchAngle  = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 3, pitchAngle - dy * SENS_V));
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
    // R 鍵切換自動公轉
    if (k === 'r') {
      autoOrbit = !autoOrbit;
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
  }

  // ——— 初始化 ———
  function init(containerEl) {
    container = containerEl;
    playerLat = 0.0; playerLon = 0.0;
    heading = 0; pitchAngle = -0.08;
    isFlying = false; flyAlt = 60; flySpeed = 30;
    autoOrbit = true;
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

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, R * 120);

    scene.add(new THREE.AmbientLight(0xffffff, 0.40));
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.5);
    sun.position.set(R * 5, R * 2, R * 3);
    scene.add(sun);

    scene.add(buildTerrain());
    scene.add(buildAtmo());
    scene.add(buildStars());

    bindEvents();
    lastTime = performance.now();
    loop(lastTime);
  }

  function dispose() {
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
