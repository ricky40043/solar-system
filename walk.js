// 行星表面漫遊模式 — 第一人稱視角 + 飛行/太空船模式
window.PlanetWalk = (function() {
  let scene, camera, renderer;
  let container, canvasEl;
  let planetKey = null;
  let clock;
  let yaw = 0, pitch = 0;
  let velocity = new THREE.Vector3();
  let keys = {};
  let isPointerDown = false;
  let lastPointer = { x: 0, y: 0 };
  let animId = null;
  let playerHeight = 1.7;
  let groundMesh = null;
  let sky = null;
  let planetSphere = null; // 高空時看到的行星球體
  let starsLayer = null;
  let flyMode = false;
  let flySpeed = 30; // 飛行速度（單位/秒）
  let onModeChange = null;
  let onAltitudeChange = null;

  const PLANET_CONFIG = {
    earth: {
      name: '地球',
      gravity: 9.8,
      skyColor: 0x88bbee,
      skyTop: 0x4477bb,
      skyBottom: 0xddeeff,
      groundColor: 0x4a6e3a,
      fogColor: 0xb8d4ee,
      fogNear: 30,
      fogFar: 280,
      ambientLight: 0xffffff,
      ambientIntensity: 0.5,
      sunColor: 0xfff5e0,
      sunIntensity: 1.4,
      hasWater: true,
      hasTrees: true,
      hasClouds: true,
      surfaceType: 'grass',
      moveSpeed: 8,
      jumpForce: 5,
    },
    mars: {
      name: '火星',
      gravity: 3.7,
      skyColor: 0xd9a579,
      skyTop: 0xc89568,
      skyBottom: 0xe8b88c,
      groundColor: 0xa84a2a,
      fogColor: 0xc89070,
      fogNear: 40,
      fogFar: 350,
      ambientLight: 0xffd0a8,
      ambientIntensity: 0.55,
      sunColor: 0xffe0b8,
      sunIntensity: 1.0,
      hasWater: false,
      hasTrees: false,
      hasClouds: false,
      surfaceType: 'sand',
      moveSpeed: 8,
      jumpForce: 8,
    },
    jupiter: {
      name: '木星',
      // 木星沒有固體表面 — 模擬「漂浮平台 + 雲海」風格
      gravity: 24.8,
      skyColor: 0xd4a574,
      skyTop: 0x8a5a3a,
      skyBottom: 0xe6c896,
      groundColor: 0xc89868,
      fogColor: 0xd4a574,
      fogNear: 60,
      fogFar: 600,
      ambientLight: 0xffd8a8,
      ambientIntensity: 0.65,
      sunColor: 0xfff0d8,
      sunIntensity: 0.6,
      hasWater: false,
      hasTrees: false,
      hasClouds: true,
      surfaceType: 'cloud',
      moveSpeed: 10,
      jumpForce: 4,
    },
    saturn: {
      name: '土星',
      gravity: 10.4,
      skyColor: 0xe8d4a0,
      skyTop: 0xb89868,
      skyBottom: 0xf0e0b0,
      groundColor: 0xc8a878,
      fogColor: 0xe0c898,
      fogNear: 60,
      fogFar: 600,
      ambientLight: 0xfff0d0,
      ambientIntensity: 0.65,
      sunColor: 0xfff0d8,
      sunIntensity: 0.45,
      hasWater: false,
      hasTrees: false,
      hasClouds: true,
      surfaceType: 'cloud',
      hasRings: true,
      moveSpeed: 10,
      jumpForce: 5,
    },
  };

  let cfg = null;

  const init = (containerEl, key) => {
    container = containerEl;
    planetKey = key;
    cfg = PLANET_CONFIG[key];
    if (!cfg) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.skyColor);
    scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200000);
    camera.position.set(0, playerHeight, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    canvasEl = renderer.domElement;

    clock = new THREE.Clock();

    buildSky();
    buildLights();
    buildTerrain();
    if (cfg.hasTrees) buildTrees();
    buildRocks();
    if (cfg.hasClouds) buildClouds();
    buildHorizonObjects();

    bindEvents();
    yaw = 0; pitch = 0;
    velocity.set(0, 0, 0);
    flyMode = false;
    flySpeed = 30;
    // 氣態巨行星：起始即飛行
    if (cfg.surfaceType === 'cloud') {
      flyMode = true;
      flySpeed = 60;
      camera.position.set(0, 50, 0);
    }
    buildPlanetSphere();
    buildStarsLayer();
    animate();
  };

  const buildSky = () => {
    // 漸層球體天空
    const geom = new THREE.SphereGeometry(800, 32, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(cfg.skyTop) },
        bottomColor: { value: new THREE.Color(cfg.skyBottom) },
        offset: { value: 33 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    sky = new THREE.Mesh(geom, mat);
    scene.add(sky);
  };

  const buildLights = () => {
    const ambient = new THREE.AmbientLight(cfg.ambientLight, cfg.ambientIntensity);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(cfg.sunColor, cfg.sunIntensity);
    sun.position.set(80, 120, 50);
    scene.add(sun);

    // 太陽 disc
    const sunGeom = new THREE.SphereGeometry(8, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: cfg.sunColor });
    const sunMesh = new THREE.Mesh(sunGeom, sunMat);
    sunMesh.position.set(300, 200, 200);
    scene.add(sunMesh);
  };

  // 程序化地形：起伏的網格
  const buildTerrain = () => {
    // 木星 / 土星：建立雲海平台 + 翻騰雲帶
    if (cfg.surfaceType === 'cloud') {
      buildGasGiantSurface();
      return;
    }
    const size = 600;
    const seg = 120;
    const geom = new THREE.PlaneGeometry(size, size, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // 多層 noise
      const h = Math.sin(x * 0.05) * Math.cos(z * 0.04) * 1.5
              + Math.sin(x * 0.12 + 1.3) * Math.cos(z * 0.09) * 0.6
              + Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.25
              + (Math.random() - 0.5) * 0.15;
      pos.setY(i, h);
    }
    geom.computeVertexNormals();

    // 頂點上色
    const colors = new Float32Array(pos.count * 3);
    const baseColor = new THREE.Color(cfg.groundColor);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const v = (Math.random() - 0.5) * 0.18;
      const lift = Math.max(0, y * 0.08);
      const c = baseColor.clone();
      c.r = Math.max(0, Math.min(1, c.r + v + lift));
      c.g = Math.max(0, Math.min(1, c.g + v + lift * 0.7));
      c.b = Math.max(0, Math.min(1, c.b + v * 0.5));
      // 地球：低處變綠，高處變土
      if (planetKey === 'earth') {
        if (y < -0.3) { c.setRGB(0.25, 0.4, 0.2); }
        else if (y > 1.0) { c.setRGB(0.45, 0.38, 0.28); }
      } else {
        // 火星：高處更紅、低處偏暗
        if (y > 0.8) c.setRGB(c.r * 1.1, c.g * 0.9, c.b * 0.8);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });
    groundMesh = new THREE.Mesh(geom, mat);
    scene.add(groundMesh);

    // 地球：水池
    if (cfg.hasWater) {
      const waterGeom = new THREE.PlaneGeometry(size, size);
      waterGeom.rotateX(-Math.PI / 2);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x2a5a8a,
        transparent: true,
        opacity: 0.7,
        roughness: 0.3,
        metalness: 0.4,
      });
      const water = new THREE.Mesh(waterGeom, waterMat);
      water.position.y = -0.6;
      scene.add(water);
    }
  };

  // 取得地形高度（近似）
  const getHeightAt = (x, z) => {
    if (cfg.surfaceType === 'cloud') {
      // 雲海高度：低頻起伏
      return Math.sin(x * 0.02) * Math.cos(z * 0.018) * 6
           + Math.sin(x * 0.05 + 1.0) * Math.cos(z * 0.04) * 2.5;
    }
    return Math.sin(x * 0.05) * Math.cos(z * 0.04) * 1.5
         + Math.sin(x * 0.12 + 1.3) * Math.cos(z * 0.09) * 0.6
         + Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.25;
  };

  // 氣態巨行星：雲海平台
  const buildGasGiantSurface = () => {
    const size = 1200;
    const seg = 180;
    const geom = new THREE.PlaneGeometry(size, size, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = Math.sin(x * 0.02) * Math.cos(z * 0.018) * 6
              + Math.sin(x * 0.05 + 1.0) * Math.cos(z * 0.04) * 2.5
              + Math.sin(x * 0.12) * 0.6;
      pos.setY(i, h);
    }
    geom.computeVertexNormals();

    // 木星：橘紅色帶；土星：金黃色帶
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // 條紋帶：依 z 軸劃分
      const band = Math.sin(z * 0.025 + Math.sin(x * 0.01) * 0.6);
      let c;
      if (planetKey === 'jupiter') {
        if (band > 0.4) c = new THREE.Color(0xe8c89a);
        else if (band > 0) c = new THREE.Color(0xc89868);
        else if (band > -0.4) c = new THREE.Color(0xa05838);
        else c = new THREE.Color(0xd8a878);
        // 大紅斑區
        const dr = Math.sqrt((x - 200) ** 2 + (z - 100) ** 2);
        if (dr < 80) c.lerp(new THREE.Color(0xb04020), Math.max(0, 1 - dr / 80) * 0.7);
      } else {
        // 土星：較淡的金黃
        if (band > 0.3) c = new THREE.Color(0xf0e0b0);
        else if (band > -0.3) c = new THREE.Color(0xd8b878);
        else c = new THREE.Color(0xb89058);
      }
      const v = (Math.random() - 0.5) * 0.06;
      c.r = Math.max(0, Math.min(1, c.r + v));
      c.g = Math.max(0, Math.min(1, c.g + v));
      c.b = Math.max(0, Math.min(1, c.b + v));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
      flatShading: false,
    });
    groundMesh = new THREE.Mesh(geom, mat);
    scene.add(groundMesh);

    // 漂浮雲簇 — 在玩家附近散布大量雲
    for (let i = 0; i < 60; i++) {
      const cloud = new THREE.Group();
      const n = 4 + Math.floor(Math.random() * 5);
      const baseColor = planetKey === 'jupiter'
        ? (Math.random() > 0.5 ? 0xeed8b0 : 0xc89868)
        : (Math.random() > 0.5 ? 0xf0e0c0 : 0xd8b878);
      for (let j = 0; j < n; j++) {
        const r = 8 + Math.random() * 12;
        const sg = new THREE.SphereGeometry(r, 10, 10);
        const sm = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.65 });
        const m = new THREE.Mesh(sg, sm);
        m.position.set(j * 10 - n * 5, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8);
        cloud.add(m);
      }
      cloud.position.set(
        (Math.random() - 0.5) * 1000,
        20 + Math.random() * 80,
        (Math.random() - 0.5) * 1000
      );
      scene.add(cloud);
    }

    // 土星：天上看到巨大環
    if (cfg.hasRings) {
      const ringGeom = new THREE.RingGeometry(180, 320, 96, 1);
      // 條紋紋理
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 64;
      const ctx = cv.getContext('2d');
      for (let i = 0; i < 512; i++) {
        const v = Math.sin(i * 0.08) * 0.3 + Math.sin(i * 0.21) * 0.2 + 0.6;
        const a = 0.4 + Math.random() * 0.4;
        ctx.fillStyle = `rgba(${230*v},${210*v},${170*v},${a})`;
        ctx.fillRect(i, 0, 1, 64);
      }
      // Cassini gap
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(340, 0, 12, 64);
      const tex = new THREE.CanvasTexture(cv);
      const ringMat = new THREE.MeshBasicMaterial({
        map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.PI / 2 - 0.3;
      ring.position.set(0, 250, -400);
      scene.add(ring);
    }

    // 木星：天空中遠方的一顆衛星（木衛三）
    if (planetKey === 'jupiter') {
      const moonGeom = new THREE.SphereGeometry(15, 16, 16);
      const moonMat = new THREE.MeshBasicMaterial({ color: 0xc8b890 });
      const moon = new THREE.Mesh(moonGeom, moonMat);
      moon.position.set(-300, 180, -350);
      scene.add(moon);
    }
  };


  const buildTrees = () => {
    const treeGroup = new THREE.Group();
    for (let i = 0; i < 80; i++) {
      const x = (Math.random() - 0.5) * 400;
      const z = (Math.random() - 0.5) * 400;
      const y = getHeightAt(x, z);
      if (y < -0.2) continue; // 不在水裡

      // 樹幹
      const trunkGeom = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.set(x, y + 1.25, z);
      treeGroup.add(trunk);

      // 樹冠
      const leavesGeom = new THREE.ConeGeometry(1.5, 3.5, 8);
      const leavesMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x2a5a2a).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
        roughness: 0.9,
        flatShading: true,
      });
      const leaves = new THREE.Mesh(leavesGeom, leavesMat);
      leaves.position.set(x, y + 4, z);
      treeGroup.add(leaves);
    }
    scene.add(treeGroup);
  };

  const buildRocks = () => {
    const count = planetKey === 'mars' ? 200 : 60;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 500;
      const z = (Math.random() - 0.5) * 500;
      const y = getHeightAt(x, z);
      if (planetKey === 'earth' && y < -0.2) continue;
      const r = Math.random() * 1.2 + 0.3;
      const geom = new THREE.DodecahedronGeometry(r, 0);
      const baseHex = planetKey === 'mars' ? 0x7a3a20 : 0x6a6055;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseHex).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15),
        roughness: 0.95,
        flatShading: true,
      });
      const rock = new THREE.Mesh(geom, mat);
      rock.position.set(x, y + r * 0.5, z);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      scene.add(rock);
    }
  };

  const buildClouds = () => {
    for (let i = 0; i < 25; i++) {
      const cloud = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < n; j++) {
        const r = 4 + Math.random() * 4;
        const geom = new THREE.SphereGeometry(r, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
        const m = new THREE.Mesh(geom, mat);
        m.position.set(j * 6 - n * 3, 0, (Math.random() - 0.5) * 4);
        cloud.add(m);
      }
      cloud.position.set((Math.random() - 0.5) * 600, 60 + Math.random() * 30, (Math.random() - 0.5) * 600);
      scene.add(cloud);
    }
  };

  const buildHorizonObjects = () => {
    // 氣態巨行星不需要遠方山脈
    if (cfg.surfaceType === 'cloud') return;
    // 遠方山脈
    const mtnCount = 18;
    for (let i = 0; i < mtnCount; i++) {
      const angle = (i / mtnCount) * Math.PI * 2;
      const dist = 320 + Math.random() * 60;
      const h = 25 + Math.random() * 30;
      const r = 30 + Math.random() * 20;
      const geom = new THREE.ConeGeometry(r, h, 5);
      const baseColor = planetKey === 'mars' ? 0x6a2a18 : 0x5a6a55;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1),
        roughness: 1.0,
        flatShading: true,
      });
      const m = new THREE.Mesh(geom, mat);
      m.position.set(Math.cos(angle) * dist, h / 2 - 2, Math.sin(angle) * dist);
      scene.add(m);
    }

    // 火星：天空中加上「地球」一個小亮點
    if (planetKey === 'mars') {
      const geom = new THREE.SphereGeometry(0.5, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0x88bbff });
      const earth = new THREE.Mesh(geom, mat);
      earth.position.set(150, 80, -200);
      scene.add(earth);
    }
    // 地球：天空中加月亮
    if (planetKey === 'earth') {
      const geom = new THREE.SphereGeometry(6, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0xeeeedd });
      const moon = new THREE.Mesh(geom, mat);
      moon.position.set(-200, 120, -250);
      scene.add(moon);
    }
  };

  // 高空時看到的行星球體（從表面下方往遠處看）
  const buildPlanetSphere = () => {
    const radius = 6000;
    const geom = new THREE.SphereGeometry(radius, 64, 64);
    // 簡單上色貼圖 — 地球：藍綠白；火星：紅；木星/土星：條紋
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (planetKey === 'earth') {
      ctx.fillStyle = '#1f4f8c'; ctx.fillRect(0, 0, 1024, 512);
      ctx.fillStyle = '#3a6e3a';
      for (let i = 0; i < 12; i++) {
        const x = Math.random() * 1024; const y = 80 + Math.random() * 350;
        const r = 40 + Math.random() * 90;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * 1024; const y = Math.random() * 512;
        const r = 10 + Math.random() * 30;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8f0ff';
      ctx.fillRect(0, 0, 1024, 30); ctx.fillRect(0, 482, 1024, 30);
    } else if (planetKey === 'mars') {
      ctx.fillStyle = '#a84a2a'; ctx.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 1024; const y = Math.random() * 512;
        const v = (Math.random() - 0.5) * 50;
        ctx.fillStyle = `rgb(${168+v},${74+v*0.5},${42+v*0.3})`;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.fillStyle = '#e8d8c0';
      ctx.fillRect(0, 0, 1024, 25); ctx.fillRect(0, 487, 1024, 25);
    } else if (planetKey === 'jupiter') {
      // 木星條紋
      for (let y = 0; y < 512; y++) {
        const band = Math.sin(y * 0.05);
        let r, g, b;
        if (band > 0.4) { r = 232; g = 200; b = 154; }
        else if (band > 0) { r = 200; g = 152; b = 104; }
        else if (band > -0.4) { r = 160; g = 88; b = 56; }
        else { r = 216; g = 168; b = 120; }
        for (let x = 0; x < 1024; x++) {
          const v = (Math.random() - 0.5) * 30 + Math.sin(x * 0.05 + y * 0.02) * 15;
          ctx.fillStyle = `rgb(${r+v},${g+v},${b+v})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      // 大紅斑
      ctx.fillStyle = 'rgba(180, 60, 40, 0.85)';
      ctx.beginPath(); ctx.ellipse(720, 320, 60, 28, 0, 0, Math.PI * 2); ctx.fill();
    } else if (planetKey === 'saturn') {
      for (let y = 0; y < 512; y++) {
        const band = Math.sin(y * 0.06);
        let r, g, b;
        if (band > 0.3) { r = 240; g = 224; b = 176; }
        else if (band > -0.3) { r = 216; g = 184; b = 120; }
        else { r = 184; g = 144; b = 88; }
        for (let x = 0; x < 1024; x++) {
          const v = (Math.random() - 0.5) * 20;
          ctx.fillStyle = `rgb(${r+v},${g+v},${b+v})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else {
      ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 1024, 512);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.95, metalness: 0,
      side: THREE.FrontSide,
    });
    planetSphere = new THREE.Mesh(geom, mat);
    planetSphere.position.set(0, -radius, 0);
    planetSphere.visible = false;
    scene.add(planetSphere);

    // 大氣輝光
    if (planetKey === 'earth' || planetKey === 'jupiter' || planetKey === 'saturn') {
      const haloColor = planetKey === 'earth' ? 0x6ab4ff : planetKey === 'jupiter' ? 0xe8b878 : 0xf0d8a0;
      const haloGeom = new THREE.SphereGeometry(radius * 1.04, 48, 48);
      const haloMat = new THREE.MeshBasicMaterial({
        color: haloColor,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeom, haloMat);
      halo.position.copy(planetSphere.position);
      halo.visible = false;
      planetSphere.userData.halo = halo;
      scene.add(halo);
    }
  };

  // 高空星空
  const buildStarsLayer = () => {
    const count = 2500;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 60000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 30, sizeAttenuation: true, transparent: true, opacity: 0 });
    starsLayer = new THREE.Points(geom, mat);
    scene.add(starsLayer);
  };

  const setFlyMode = (on) => {
    flyMode = on;
    if (onModeChange) onModeChange(flyMode);
    if (on) {
      // 起飛：給個向上初速
      velocity.set(0, 15, 0);
    }
  };

  const setFlySpeed = (v) => { flySpeed = v; };

  const onKeyDown = (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyF') {
      setFlyMode(!flyMode);
      return;
    }
    if (!flyMode && e.code === 'Space' && Math.abs(velocity.y) < 0.01) {
      velocity.y = cfg.jumpForce;
    }
  };
  const onKeyUp = (e) => { keys[e.code] = false; };

  const onPointerDown = (e) => {
    isPointerDown = true;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    canvasEl.style.cursor = 'grabbing';
  };
  const onPointerMove = (e) => {
    if (!isPointerDown) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    yaw -= dx * 0.003;
    pitch -= dy * 0.003;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
  };
  const onPointerUp = () => {
    isPointerDown = false;
    if (canvasEl) canvasEl.style.cursor = 'grab';
  };
  const onResize = () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  const bindEvents = () => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);
    canvasEl.style.cursor = 'grab';
  };

  const unbindEvents = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    if (canvasEl) canvasEl.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', onResize);
  };

  const animate = () => {
    animId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    if (flyMode) {
      // ===== 太空船飛行模式 =====
      const forward = new THREE.Vector3(
        -Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
      );
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const move = new THREE.Vector3();
      if (keys['KeyW'] || keys['ArrowUp']) move.add(forward);
      if (keys['KeyS'] || keys['ArrowDown']) move.sub(forward);
      if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);
      if (keys['KeyD'] || keys['ArrowRight']) move.add(right);
      if (keys['Space']) move.y += 1;
      if (keys['ShiftLeft'] || keys['ShiftRight']) move.y -= 1;
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(flySpeed * dt);
        camera.position.add(move);
      }
      // 防止穿地
      const groundY = getHeightAt(camera.position.x, camera.position.z) + 0.5;
      if (camera.position.y < groundY) camera.position.y = groundY;
      velocity.set(0, 0, 0);
    } else {
      // ===== 步行模式 =====
      const speed = cfg.moveSpeed;
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const move = new THREE.Vector3();
      if (keys['KeyW'] || keys['ArrowUp']) move.add(forward);
      if (keys['KeyS'] || keys['ArrowDown']) move.sub(forward);
      if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);
      if (keys['KeyD'] || keys['ArrowRight']) move.add(right);
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
      camera.position.x += move.x;
      camera.position.z += move.z;
      velocity.y -= cfg.gravity * dt;
      camera.position.y += velocity.y * dt;
      const groundY = getHeightAt(camera.position.x, camera.position.z) + playerHeight;
      if (camera.position.y < groundY) {
        camera.position.y = groundY;
        velocity.y = 0;
      }
    }

    // 視角
    const dir = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch)
    );
    camera.lookAt(camera.position.clone().add(dir));

    // 高度相關效果：超過 200m 開始顯示行星球體 + 星空，霧氣淡出
    const altitude = camera.position.y;
    const fadeStart = 150;
    const fadeEnd = 800;
    const t = Math.max(0, Math.min(1, (altitude - fadeStart) / (fadeEnd - fadeStart)));
    if (planetSphere) {
      planetSphere.visible = t > 0.01;
      if (planetSphere.userData.halo) {
        planetSphere.userData.halo.visible = t > 0.01;
        planetSphere.userData.halo.material.opacity = 0.18 * t;
      }
    }
    if (starsLayer) {
      starsLayer.material.opacity = t;
    }
    if (scene.fog) {
      scene.fog.far = cfg.fogFar + t * 8000;
    }
    if (sky && sky.material.uniforms) {
      // 高空背景變黑（藉由淡化天空 sphere）
      sky.material.uniforms.topColor.value.setRGB(
        new THREE.Color(cfg.skyTop).r * (1 - t),
        new THREE.Color(cfg.skyTop).g * (1 - t),
        new THREE.Color(cfg.skyTop).b * (1 - t)
      );
      sky.material.uniforms.bottomColor.value.setRGB(
        new THREE.Color(cfg.skyBottom).r * (1 - t * 0.8),
        new THREE.Color(cfg.skyBottom).g * (1 - t * 0.8),
        new THREE.Color(cfg.skyBottom).b * (1 - t * 0.8)
      );
    }
    if (scene.background && scene.background.lerp) {
      scene.background.lerp(new THREE.Color(0x000008), t * 0.05);
    }

    // 更新 GPS HUD
    if (window.updateWalkHUD) {
      window.updateWalkHUD({
        x: camera.position.x,
        z: camera.position.z,
        elevation: camera.position.y - playerHeight,
        altitude: camera.position.y,
        yaw: yaw,
        planetKey: planetKey,
        flyMode: flyMode,
        flySpeed: flySpeed,
      });
    }

    renderer.render(scene, camera);
  };

  const dispose = () => {
    if (animId) cancelAnimationFrame(animId);
    unbindEvents();
    if (renderer) {
      renderer.dispose();
      if (canvasEl && canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl);
    }
    scene = camera = renderer = canvasEl = null;
    keys = {};
    velocity = new THREE.Vector3();
  };

  return {
    init,
    dispose,
    isAvailable: (key) => !!PLANET_CONFIG[key],
    getName: (key) => PLANET_CONFIG[key]?.name || key,
    setFlyMode,
    setFlySpeed,
    isFlying: () => flyMode,
    getFlySpeed: () => flySpeed,
    onModeChange: (cb) => { onModeChange = cb; },
  };
})();
