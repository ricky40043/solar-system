// 行星表面漫遊模式 — 第一人稱視角
window.PlanetWalk = (function() {
  let scene, camera, renderer, canvasEl, container;
  let planetKey = null, cfg = null;
  let clock;
  let yaw = 0, pitch = 0;
  let velocity = new THREE.Vector3();
  let keys = {};
  let animId = null;
  let playerHeight = 1.7;
  let groundMesh = null;
  let sky = null;
  let planetSphere = null;
  let starsLayer = null;
  let flyMode = false;
  let flySpeed = 30;
  let onModeChangeCb = null;
  let isPointerDown = false;
  let lastPointer = { x: 0, y: 0 };
  let windParticles = null;
  let cachedCraters = [];

  // ===== Planet configs — fog distances sized to hide terrain edge =====
  const PLANET_CONFIG = {
    mercury: {
      name: '水星', gravity: 3.7,
      skyTop: 0x000000, skyBottom: 0x000000, skyColor: 0x000000,
      groundColor: 0x7a6a5a,
      fogColor: 0x000000, fogNear: 0, fogFar: 99999,
      ambientLight: 0xffffff, ambientIntensity: 0.15,
      sunColor: 0xffffff, sunIntensity: 4.5,
      hasWater: false, hasTrees: false, hasClouds: false,
      surfaceType: 'rocky', moveSpeed: 8, jumpForce: 9,
      hasStarsAlways: true,
      terrainSize: 40000, terrainSegs: 160,
      objRadius: 6000,
    },
    venus: {
      name: '金星', gravity: 8.87,
      skyTop: 0x8a3010, skyBottom: 0xe09040, skyColor: 0xcc7020,
      groundColor: 0x5a2808,
      fogColor: 0xb06020, fogNear: 40, fogFar: 700,
      ambientLight: 0xff9040, ambientIntensity: 0.95,
      sunColor: 0xffcc80, sunIntensity: 0.35,
      hasWater: false, hasTrees: false, hasClouds: false,
      surfaceType: 'volcanic', moveSpeed: 8, jumpForce: 4,
      terrainSize: 8000, terrainSegs: 160,
      objRadius: 500,
    },
    earth: {
      name: '地球', gravity: 9.8,
      skyTop: 0x4477bb, skyBottom: 0xddeeff, skyColor: 0x88bbee,
      groundColor: 0x4a6e3a,
      fogColor: 0xb8d4ee, fogNear: 100, fogFar: 2000,
      ambientLight: 0xffffff, ambientIntensity: 0.5,
      sunColor: 0xfff5e0, sunIntensity: 1.4,
      hasWater: true, hasTrees: true, hasClouds: true,
      surfaceType: 'grass', moveSpeed: 8, jumpForce: 5,
      terrainSize: 14000, terrainSegs: 200,
      objRadius: 1400,
    },
    mars: {
      name: '火星', gravity: 3.7,
      skyTop: 0xc89568, skyBottom: 0xe8b88c, skyColor: 0xd9a579,
      groundColor: 0xa84a2a,
      fogColor: 0xc89070, fogNear: 100, fogFar: 3000,
      ambientLight: 0xffd0a8, ambientIntensity: 0.55,
      sunColor: 0xffe0b8, sunIntensity: 1.0,
      hasWater: false, hasTrees: false, hasClouds: false,
      surfaceType: 'sand', moveSpeed: 8, jumpForce: 8,
      terrainSize: 18000, terrainSegs: 200,
      objRadius: 2000,
    },
    jupiter: {
      name: '木星', gravity: 24.8,
      skyTop: 0x8a5a3a, skyBottom: 0xe6c896, skyColor: 0xd4a574,
      groundColor: 0xc89868,
      fogColor: 0xd4a574, fogNear: 200, fogFar: 3000,
      ambientLight: 0xffd8a8, ambientIntensity: 0.65,
      sunColor: 0xfff0d8, sunIntensity: 0.6,
      hasWater: false, hasTrees: false, hasClouds: true,
      surfaceType: 'cloud', moveSpeed: 10, jumpForce: 4,
      terrainSize: 1200, terrainSegs: 180, objRadius: 800,
    },
    saturn: {
      name: '土星', gravity: 10.4,
      skyTop: 0xb89868, skyBottom: 0xf0e0b0, skyColor: 0xe8d4a0,
      groundColor: 0xc8a878,
      fogColor: 0xe0c898, fogNear: 200, fogFar: 3000,
      ambientLight: 0xfff0d0, ambientIntensity: 0.65,
      sunColor: 0xfff0d8, sunIntensity: 0.45,
      hasWater: false, hasTrees: false, hasClouds: true,
      surfaceType: 'cloud', hasRings: true, moveSpeed: 10, jumpForce: 5,
      terrainSize: 1200, terrainSegs: 180, objRadius: 800,
    },
    uranus: {
      name: '天王星', gravity: 8.69,
      skyTop: 0x2a8098, skyBottom: 0x90d8e8, skyColor: 0x5ab8c8,
      groundColor: 0x70c0d0,
      fogColor: 0x70c8d8, fogNear: 200, fogFar: 4000,
      ambientLight: 0xa0e8f8, ambientIntensity: 0.55,
      sunColor: 0xe0f0ff, sunIntensity: 0.08,
      hasWater: false, hasTrees: false, hasClouds: true,
      surfaceType: 'ice', hasRings: true, moveSpeed: 8, jumpForce: 6,
      terrainSize: 20000, terrainSegs: 180,
      objRadius: 2500,
    },
    neptune: {
      name: '海王星', gravity: 11.15,
      skyTop: 0x020818, skyBottom: 0x0a1540, skyColor: 0x050c28,
      groundColor: 0x102040,
      fogColor: 0x071020, fogNear: 80, fogFar: 2000,
      ambientLight: 0x5060d0, ambientIntensity: 0.4,
      sunColor: 0x8090ff, sunIntensity: 0.05,
      hasWater: false, hasTrees: false, hasClouds: false,
      surfaceType: 'storm', moveSpeed: 8, jumpForce: 5,
      terrainSize: 14000, terrainSegs: 180,
      objRadius: 1400,
    },
  };

  // ===== Height function — must match geometry =====
  const getHeightAt = (x, z) => {
    switch (cfg.surfaceType) {
      case 'grass':
        return Math.sin(x*0.00035)*Math.cos(z*0.00028)*120
             + Math.sin(x*0.0012+1.3)*Math.cos(z*0.0009)*40
             + Math.sin(x*0.004)*Math.cos(z*0.003)*12;
      case 'sand':
        return Math.sin(x*0.00025)*Math.cos(z*0.0002)*160
             + Math.sin(x*0.001+1.8)*Math.cos(z*0.00075)*55
             + Math.sin(x*0.003)*Math.cos(z*0.0025)*18;
      case 'rocky': {
        let h = Math.sin(x*0.00015)*Math.cos(z*0.00012)*60;
        cachedCraters.forEach(c => {
          const d = Math.sqrt((x-c.x)**2+(z-c.z)**2);
          if (d < c.r*1.35) {
            const t = d/c.r;
            if (t <= 1.0) h += -c.depth*(1-t*t*0.7);
            else { const rt=(t-1.0)/0.35; h += c.depth*0.5*Math.max(0,1-rt)*Math.sin(rt*Math.PI); }
          }
        });
        return h;
      }
      case 'volcanic':
        return Math.sin(x*0.0008)*Math.cos(z*0.0007)*100
             + Math.sin(x*0.0025+0.5)*Math.cos(z*0.002)*40
             + Math.sin(x*0.007)*Math.cos(z*0.006)*15;
      case 'ice':
        return Math.sin(x*0.0003)*Math.cos(z*0.00025)*70
             + Math.sin(x*0.001+1.0)*Math.cos(z*0.0008)*20
             + Math.sin(x*0.004)*Math.cos(z*0.003)*6;
      case 'storm':
        return Math.sin(x*0.0003)*Math.cos(z*0.00025)*90
             + Math.sin(x*0.001+1.5)*Math.cos(z*0.0008)*30
             + Math.sin(x*0.003)*Math.cos(z*0.0025)*10;
      case 'cloud':
        return Math.sin(x*0.02)*Math.cos(z*0.018)*6
             + Math.sin(x*0.05+1.0)*Math.cos(z*0.04)*2.5;
      default: return 0;
    }
  };

  // ===== Init =====
  const init = (containerEl, key) => {
    container = containerEl;
    planetKey = key;
    cfg = PLANET_CONFIG[key];
    if (!cfg) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.skyColor);
    if (cfg.fogFar < 50000) scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.5, 300000);
    camera.position.set(0, playerHeight, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    canvasEl = renderer.domElement;

    clock = new THREE.Clock();
    yaw = 0; pitch = 0; velocity.set(0,0,0);
    flyMode = false; flySpeed = 30;
    isPointerDown = false; windParticles = null; cachedCraters = [];

    buildSky();
    buildLights();
    buildTerrain();
    if (cfg.hasTrees) buildTrees();
    buildRocks();
    if (cfg.hasClouds) buildClouds();
    buildHorizonObjects();

    if (cfg.surfaceType === 'cloud') {
      flyMode = true; flySpeed = 60;
      camera.position.set(0, 50, 0);
    }

    buildPlanetSphere();
    buildStarsLayer();
    bindEvents();
    animate();
  };

  // ===== Sky =====
  const buildSky = () => {
    if (cfg.hasStarsAlways) { scene.background = new THREE.Color(0x000000); return; }
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:    { value: new THREE.Color(cfg.skyTop) },
        bottomColor: { value: new THREE.Color(cfg.skyBottom) },
        offset: { value: 33 }, exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = (modelMatrix * vec4(position,1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor, bottomColor;
        uniform float offset, exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0);
        }`,
      side: THREE.BackSide,
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(200000, 32, 32), mat);
    scene.add(sky);
  };

  // ===== Lights =====
  const buildLights = () => {
    scene.add(new THREE.AmbientLight(cfg.ambientLight, cfg.ambientIntensity));
    const sunLight = new THREE.DirectionalLight(cfg.sunColor, cfg.sunIntensity);
    sunLight.position.set(planetKey==='mercury'?0:80, 120, planetKey==='mercury'?0:50);
    scene.add(sunLight);

    const sunSize = planetKey==='mercury' ? 24 : (planetKey==='neptune'||planetKey==='uranus' ? 2 : 8);
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(sunSize,24,24), new THREE.MeshBasicMaterial({color:cfg.sunColor}));
    sunMesh.position.set(planetKey==='mercury'?0:cfg.fogFar*0.6, planetKey==='mercury'?cfg.fogFar*0.15:cfg.fogFar*0.4, planetKey==='mercury'?0:cfg.fogFar*0.4);
    scene.add(sunMesh);

    if (planetKey==='venus') {
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(195000,32,16),
        new THREE.MeshBasicMaterial({color:0xd08040,transparent:true,opacity:0.3,side:THREE.BackSide,depthWrite:false})));
    }
    if (planetKey==='neptune') {
      const sl = new THREE.PointLight(0x4060ff, 0.5, 3000);
      sl.position.set(0,500,0); scene.add(sl);
    }
  };

  // ===== Terrain =====
  const buildTerrain = () => {
    const t = cfg.surfaceType;
    if (t==='cloud') buildGasGiantSurface();
    else if (t==='rocky') buildRockyTerrain();
    else if (t==='volcanic') buildVolcanicTerrain();
    else if (t==='ice') buildIceTerrain();
    else if (t==='storm') buildStormTerrain();
    else buildNaturalTerrain();
  };

  const makeTerrainMesh = (size, segs, heightFn, colorFn, matProps) => {
    const geom = new THREE.PlaneGeometry(size, size, segs, segs);
    geom.rotateX(-Math.PI/2);
    const pos = geom.attributes.position;
    for (let i=0; i<pos.count; i++) {
      pos.setY(i, heightFn(pos.getX(i), pos.getZ(i)));
    }
    geom.computeVertexNormals();
    if (colorFn) {
      const colors = new Float32Array(pos.count*3);
      for (let i=0; i<pos.count; i++) {
        const [r,g,b] = colorFn(pos.getX(i), pos.getZ(i), pos.getY(i));
        colors[i*3]=r; colors[i*3+1]=g; colors[i*3+2]=b;
      }
      geom.setAttribute('color', new THREE.BufferAttribute(colors,3));
    }
    return new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
      vertexColors:!!colorFn, roughness:0.95, metalness:0, flatShading:true, ...matProps
    }));
  };

  const buildNaturalTerrain = () => {
    const isEarth = planetKey==='earth';
    groundMesh = makeTerrainMesh(
      cfg.terrainSize, cfg.terrainSegs,
      (x,z) => getHeightAt(x,z) + (Math.random()-0.5)*2,
      (x,z,y) => {
        const norm = y / 120;
        if (isEarth) {
          if (y < -20) return [0.18, 0.30, 0.22];
          if (y < 10)  return [0.28+norm*0.05, 0.42+norm*0.04, 0.22];
          if (y > 80)  return [0.55, 0.50, 0.42];
          return [0.34+norm*0.05, 0.48+norm*0.04, 0.28];
        } else {
          // Mars
          if (y > 100) return [0.52, 0.26, 0.14];
          return [0.40+norm*0.08, 0.20+norm*0.04, 0.12+norm*0.02];
        }
      }
    );
    scene.add(groundMesh);
    if (cfg.hasWater) {
      const wg = new THREE.PlaneGeometry(cfg.terrainSize, cfg.terrainSize);
      wg.rotateX(-Math.PI/2);
      scene.add(new THREE.Mesh(wg, new THREE.MeshStandardMaterial({
        color:0x2a5a8a, transparent:true, opacity:0.72, roughness:0.25, metalness:0.45,
      })));
    }
  };

  const buildRockyTerrain = () => {
    cachedCraters = [];
    const spread = cfg.terrainSize * 0.45;
    for (let i=0; i<60; i++) {
      cachedCraters.push({
        x:(Math.random()-0.5)*spread*2, z:(Math.random()-0.5)*spread*2,
        r: 80+Math.random()*400, depth: 8+Math.random()*60,
      });
    }
    groundMesh = makeTerrainMesh(
      cfg.terrainSize, cfg.terrainSegs,
      (x,z) => getHeightAt(x,z) + (Math.random()-0.5)*2,
      (x,z,y) => { const v=(Math.random()-0.5)*0.1; return [0.50+v, 0.46+v, 0.41+v]; }
    );
    scene.add(groundMesh);
  };

  const buildVolcanicTerrain = () => {
    groundMesh = makeTerrainMesh(
      cfg.terrainSize, cfg.terrainSegs,
      (x,z) => getHeightAt(x,z) + (Math.random()-0.5)*3,
      (x,z,y) => {
        const v=(Math.random()-0.5)*0.08;
        if (y > 60) return [0.50+v, 0.20+v*0.5, 0.05];
        if (y > 20) return [0.35+v, 0.14+v*0.5, 0.04];
        return [0.20+v, 0.08+v*0.3, 0.03];
      },
      { emissive:new THREE.Color(0x1a0400), emissiveIntensity:0.4 }
    );
    scene.add(groundMesh);
    // lava cracks
    for (let i=0; i<20; i++) {
      const pts=[];
      let sx=(Math.random()-0.5)*cfg.objRadius*2, sz=(Math.random()-0.5)*cfg.objRadius*2;
      for (let j=0; j<22; j++) {
        pts.push(new THREE.Vector3(sx, getHeightAt(sx,sz)+0.5, sz));
        sx+=(Math.random()-0.5)*50; sz+=(Math.random()-0.5)*50;
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({color:0xff4400,transparent:true,opacity:0.9})));
    }
    for (let i=0; i<15; i++) {
      const lx=(Math.random()-0.5)*cfg.objRadius, lz=(Math.random()-0.5)*cfg.objRadius;
      const pg = new THREE.CircleGeometry(5+Math.random()*20, 16); pg.rotateX(-Math.PI/2);
      const pool = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({color:0xff3300,transparent:true,opacity:0.9}));
      pool.position.set(lx, getHeightAt(lx,lz)+0.3, lz);
      scene.add(pool);
    }
  };

  const buildIceTerrain = () => {
    groundMesh = makeTerrainMesh(
      cfg.terrainSize, cfg.terrainSegs,
      (x,z) => getHeightAt(x,z) + (Math.random()-0.5)*1.5,
      (x,z,y) => {
        const v=(Math.random()-0.5)*0.06;
        if (y > 45) return [Math.min(1,0.94+v), Math.min(1,0.98+v), 1.0];
        return [Math.min(1,0.60+v), Math.min(1,0.86+v), Math.min(1,0.93+v)];
      },
      { roughness:0.3, metalness:0.3, flatShading:false }
    );
    scene.add(groundMesh);
    if (cfg.hasRings) {
      const cv=document.createElement('canvas'); cv.width=512; cv.height=64;
      const ctx=cv.getContext('2d');
      for (let i=0; i<512; i++) {
        const v=Math.sin(i*0.12)*0.3+0.5;
        ctx.fillStyle=`rgba(${Math.floor(160*v+60)},${Math.floor(210*v+20)},${Math.floor(220*v+10)},${(0.3+Math.random()*0.25).toFixed(2)})`;
        ctx.fillRect(i,0,1,64);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(6000,8500,96,1),
        new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),side:THREE.DoubleSide,transparent:true,opacity:0.55,depthWrite:false}));
      ring.rotation.z = Math.PI/2 - THREE.MathUtils.degToRad(7.77);
      ring.position.set(0, 6000, -12000);
      scene.add(ring);
    }
  };

  const buildStormTerrain = () => {
    groundMesh = makeTerrainMesh(
      cfg.terrainSize, cfg.terrainSegs,
      (x,z) => getHeightAt(x,z) + (Math.random()-0.5)*4,
      (x,z,y) => {
        const v=(Math.random()-0.5)*0.05;
        if (y > 55) return [Math.max(0,0.10+v), Math.max(0,0.18+v), Math.max(0,0.52+v)];
        return [Math.max(0,0.04+v), Math.max(0,0.10+v), Math.max(0,0.32+v)];
      },
      { emissive:new THREE.Color(0x000810), emissiveIntensity:0.35 }
    );
    scene.add(groundMesh);
    // wind particles
    const count=3000;
    const wg = new THREE.BufferGeometry();
    const wPos=new Float32Array(count*3), wVel=new Float32Array(count*3);
    for (let i=0; i<count; i++) {
      wPos[i*3]=(Math.random()-0.5)*cfg.objRadius*2; wPos[i*3+1]=Math.random()*200+5; wPos[i*3+2]=(Math.random()-0.5)*cfg.objRadius*2;
      wVel[i*3]=100+Math.random()*150; wVel[i*3+1]=(Math.random()-0.5)*8; wVel[i*3+2]=(Math.random()-0.5)*30;
    }
    wg.setAttribute('position', new THREE.BufferAttribute(wPos,3));
    wg.userData.velocity = wVel;
    windParticles = new THREE.Points(wg, new THREE.PointsMaterial({color:0x8090ff,size:0.5,transparent:true,opacity:0.55,sizeAttenuation:true}));
    scene.add(windParticles);
  };

  const buildGasGiantSurface = () => {
    const size=1200, seg=180;
    const geom = new THREE.PlaneGeometry(size, size, seg, seg);
    geom.rotateX(-Math.PI/2);
    const pos = geom.attributes.position;
    for (let i=0; i<pos.count; i++) {
      const x=pos.getX(i), z=pos.getZ(i);
      pos.setY(i, Math.sin(x*0.02)*Math.cos(z*0.018)*6+Math.sin(x*0.05+1.0)*Math.cos(z*0.04)*2.5+Math.sin(x*0.12)*0.6);
    }
    geom.computeVertexNormals();
    const colors=new Float32Array(pos.count*3);
    for (let i=0; i<pos.count; i++) {
      const x=pos.getX(i), z=pos.getZ(i);
      const band=Math.sin(z*0.025+Math.sin(x*0.01)*0.6);
      let c;
      if (planetKey==='jupiter') {
        if(band>0.4)c=new THREE.Color(0xe8c89a); else if(band>0)c=new THREE.Color(0xc89868);
        else if(band>-0.4)c=new THREE.Color(0xa05838); else c=new THREE.Color(0xd8a878);
        const dr=Math.sqrt((x-200)**2+(z-100)**2);
        if(dr<80)c.lerp(new THREE.Color(0xb04020),Math.max(0,1-dr/80)*0.7);
      } else {
        if(band>0.3)c=new THREE.Color(0xf0e0b0); else if(band>-0.3)c=new THREE.Color(0xd8b878); else c=new THREE.Color(0xb89058);
      }
      const v=(Math.random()-0.5)*0.06;
      c.r=Math.max(0,Math.min(1,c.r+v)); c.g=Math.max(0,Math.min(1,c.g+v)); c.b=Math.max(0,Math.min(1,c.b+v));
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors,3));
    groundMesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({vertexColors:true,roughness:1.0,flatShading:false}));
    scene.add(groundMesh);
    for (let i=0; i<60; i++) {
      const cloud=new THREE.Group();
      const n=4+Math.floor(Math.random()*5);
      const baseColor=planetKey==='jupiter'?(Math.random()>0.5?0xeed8b0:0xc89868):(Math.random()>0.5?0xf0e0c0:0xd8b878);
      for (let j=0; j<n; j++) {
        const r=8+Math.random()*12;
        const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,10),new THREE.MeshBasicMaterial({color:baseColor,transparent:true,opacity:0.65}));
        m.position.set(j*10-n*5,(Math.random()-0.5)*4,(Math.random()-0.5)*8); cloud.add(m);
      }
      cloud.position.set((Math.random()-0.5)*1000,20+Math.random()*80,(Math.random()-0.5)*1000);
      scene.add(cloud);
    }
    if (cfg.hasRings) {
      const cv=document.createElement('canvas'); cv.width=512; cv.height=64;
      const ctx=cv.getContext('2d');
      for (let i=0; i<512; i++) {
        const v=Math.sin(i*0.08)*0.3+Math.sin(i*0.21)*0.2+0.6; const a=0.4+Math.random()*0.4;
        ctx.fillStyle=`rgba(${Math.floor(230*v)},${Math.floor(210*v)},${Math.floor(170*v)},${a.toFixed(2)})`;
        ctx.fillRect(i,0,1,64);
      }
      ctx.fillStyle='rgba(0,0,0,0.85)'; ctx.fillRect(340,0,12,64);
      const ring=new THREE.Mesh(new THREE.RingGeometry(180,320,96,1),
        new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),side:THREE.DoubleSide,transparent:true,opacity:0.85,depthWrite:false}));
      ring.rotation.x=Math.PI/2-0.3; ring.position.set(0,250,-400); scene.add(ring);
    }
    if (planetKey==='jupiter') {
      const moon=new THREE.Mesh(new THREE.SphereGeometry(15,16,16),new THREE.MeshBasicMaterial({color:0xc8b890}));
      moon.position.set(-300,180,-350); scene.add(moon);
    }
  };

  // ===== Trees =====
  const buildTrees = () => {
    const r = cfg.objRadius;
    const tg = new THREE.Group();
    for (let i=0; i<120; i++) {
      const angle=Math.random()*Math.PI*2, dist=80+Math.random()*r;
      const x=Math.cos(angle)*dist, z=Math.sin(angle)*dist;
      const y = getHeightAt(x,z);
      if (y < -15) continue;
      const scale = 0.8+Math.random()*0.5;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.5,4*scale,6),new THREE.MeshStandardMaterial({color:0x4a3520,roughness:0.9}));
      trunk.position.set(x,y+2*scale,z); tg.add(trunk);
      const leaves=new THREE.Mesh(new THREE.ConeGeometry(2.5*scale,5*scale,8),new THREE.MeshStandardMaterial({color:new THREE.Color(0x2a5a2a).offsetHSL(0,0,(Math.random()-0.5)*0.1),roughness:0.9,flatShading:true}));
      leaves.position.set(x,y+6.5*scale,z); tg.add(leaves);
    }
    scene.add(tg);
  };

  // ===== Rocks =====
  const buildRocks = () => {
    let count, baseHex, maxR;
    const r = cfg.objRadius;
    if (cfg.surfaceType==='rocky')    { count=500; baseHex=0x7a6a5a; maxR=20; }
    else if (cfg.surfaceType==='volcanic') { count=150; baseHex=0x4a2010; maxR=12; }
    else if (planetKey==='mars')      { count=400; baseHex=0x7a3a20; maxR=15; }
    else if (planetKey==='earth')     { count=100; baseHex=0x6a6055; maxR=6; }
    else if (cfg.surfaceType==='ice') { count=80;  baseHex=0x80c8d8; maxR=25; }
    else return;
    for (let i=0; i<count; i++) {
      const angle=Math.random()*Math.PI*2, dist=30+Math.random()*r;
      const x=Math.cos(angle)*dist, z=Math.sin(angle)*dist;
      const y=getHeightAt(x,z);
      if (planetKey==='earth' && y < -15) continue;
      const rr=Math.random()*maxR+2;
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(rr,0),
        new THREE.MeshStandardMaterial({color:new THREE.Color(baseHex).offsetHSL(0,0,(Math.random()-0.5)*0.15),roughness:0.95,flatShading:true}));
      rock.position.set(x, y+rr*0.5, z);
      rock.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
      scene.add(rock);
    }
  };

  // ===== Clouds =====
  const buildClouds = () => {
    const cloudColor = planetKey==='uranus' ? 0xb0e8f0 : 0xffffff;
    const opacity = planetKey==='uranus' ? 0.5 : 0.7;
    const r = cfg.objRadius;
    for (let i=0; i<40; i++) {
      const cloud=new THREE.Group();
      const n=3+Math.floor(Math.random()*5);
      for (let j=0; j<n; j++) {
        const cr=20+Math.random()*30;
        const m=new THREE.Mesh(new THREE.SphereGeometry(cr,8,8),new THREE.MeshBasicMaterial({color:cloudColor,transparent:true,opacity}));
        m.position.set(j*25-n*12,0,(Math.random()-0.5)*15); cloud.add(m);
      }
      const angle=Math.random()*Math.PI*2, dist=100+Math.random()*r*0.8;
      cloud.position.set(Math.cos(angle)*dist, 200+Math.random()*150, Math.sin(angle)*dist);
      scene.add(cloud);
    }
  };

  // ===== Horizon mountains / features =====
  const buildHorizonObjects = () => {
    if (cfg.surfaceType==='cloud') return;
    const r = cfg.objRadius;
    const mtnCount = 28;
    for (let i=0; i<mtnCount; i++) {
      const angle = (i/mtnCount)*Math.PI*2 + (Math.random()-0.5)*0.4;
      const dist = r*0.6 + Math.random()*r*0.35;
      let h, base, baseColor;
      if (planetKey==='mercury')  { base=500+Math.random()*200; h=80+Math.random()*120; baseColor=0x7a6a5a; }
      else if (planetKey==='venus'){ base=150+Math.random()*80;  h=300+Math.random()*500; baseColor=0x3a1808; }
      else if (planetKey==='uranus'){base=400+Math.random()*200; h=200+Math.random()*300; baseColor=0x50a0b8;}
      else if (planetKey==='neptune'){base=300+Math.random()*200;h=250+Math.random()*350;baseColor=0x0a1830;}
      else if (planetKey==='mars') { base=300+Math.random()*200; h=200+Math.random()*400; baseColor=0x6a2a18; }
      else                         { base=200+Math.random()*150; h=150+Math.random()*300; baseColor=0x5a6a55; }
      const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(baseColor).offsetHSL(0,0,(Math.random()-0.5)*0.1),roughness:1.0,flatShading:true});
      if (planetKey==='venus') { mat.emissive=new THREE.Color(0x0a0200); mat.emissiveIntensity=0.15; }
      const m=new THREE.Mesh(new THREE.ConeGeometry(base,h,5+Math.floor(Math.random()*4)),mat);
      const mx=Math.cos(angle)*dist, mz=Math.sin(angle)*dist;
      m.position.set(mx, getHeightAt(mx,mz)+h/2-10, mz);
      scene.add(m);
    }
    // Sky objects
    if (planetKey==='mars')   { const e=new THREE.Mesh(new THREE.SphereGeometry(3,8,8),new THREE.MeshBasicMaterial({color:0x88bbff})); e.position.set(r*0.5,r*0.15,-r*0.6); scene.add(e); }
    if (planetKey==='earth')  { const mo=new THREE.Mesh(new THREE.SphereGeometry(40,16,16),new THREE.MeshBasicMaterial({color:0xeeeedd})); mo.position.set(-r*0.5,r*0.2,-r*0.6); scene.add(mo); }
    if (planetKey==='uranus') { const ti=new THREE.Mesh(new THREE.SphereGeometry(25,16,16),new THREE.MeshBasicMaterial({color:0xb0a898})); ti.position.set(-r*0.5,r*0.2,-r*0.6); scene.add(ti); }
    if (planetKey==='neptune'){ const tr=new THREE.Mesh(new THREE.SphereGeometry(20,16,16),new THREE.MeshBasicMaterial({color:0xc0b8a8})); tr.position.set(r*0.4,r*0.15,-r*0.5); scene.add(tr); }
  };

  // ===== Planet sphere — only shows at very high altitude =====
  const buildPlanetSphere = () => {
    const radius = 60000;
    const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=512;
    const ctx=canvas.getContext('2d');
    if (planetKey==='earth') {
      ctx.fillStyle='#1f4f8c'; ctx.fillRect(0,0,1024,512);
      ctx.fillStyle='#3a6e3a';
      for (let i=0; i<12; i++) { const x=Math.random()*1024,y=80+Math.random()*350,r=40+Math.random()*90; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
      ctx.globalAlpha=0.55; ctx.fillStyle='#ffffff';
      for (let i=0; i<80; i++) { const x=Math.random()*1024,y=Math.random()*512,r=10+Math.random()*30; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
      ctx.globalAlpha=1; ctx.fillStyle='#e8f0ff'; ctx.fillRect(0,0,1024,30); ctx.fillRect(0,482,1024,30);
    } else if (planetKey==='mars') {
      ctx.fillStyle='#a84a2a'; ctx.fillRect(0,0,1024,512);
      for (let i=0; i<5000; i++) { const x=Math.random()*1024,y=Math.random()*512,v=(Math.random()-0.5)*50; ctx.fillStyle=`rgb(${168+v|0},${74+v*0.5|0},${42+v*0.3|0})`; ctx.fillRect(x,y,2,2); }
    } else if (planetKey==='mercury') {
      ctx.fillStyle='#6a5a48'; ctx.fillRect(0,0,1024,512);
      for (let i=0; i<30; i++) { const x=Math.random()*1024,y=Math.random()*512,r=15+Math.random()*50; ctx.fillStyle=`rgba(0,0,0,${(0.3+Math.random()*0.4).toFixed(2)})`; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
    } else if (planetKey==='venus') {
      for (let y=0; y<512; y++) { const band=Math.sin(y*0.03+Math.cos(y*0.007)*3); const r=180+band*30|0,g=100+band*20|0,b=20+band*10|0; for (let x=0; x<1024; x++) { const v=(Math.random()-0.5)*20|0; ctx.fillStyle=`rgb(${r+v},${g+v*0.5|0},${b})`; ctx.fillRect(x,y,1,1); } }
    } else if (planetKey==='jupiter') {
      for (let y=0; y<512; y++) { const band=Math.sin(y*0.05); let r,g,b; if(band>0.4){r=232;g=200;b=154;}else if(band>0){r=200;g=152;b=104;}else if(band>-0.4){r=160;g=88;b=56;}else{r=216;g=168;b=120;} for (let x=0; x<1024; x++) { const v=(Math.random()-0.5)*30+Math.sin(x*0.05+y*0.02)*15|0; ctx.fillStyle=`rgb(${r+v|0},${g+v|0},${b+v|0})`; ctx.fillRect(x,y,1,1); } }
      ctx.fillStyle='rgba(180,60,40,0.85)'; ctx.beginPath(); ctx.ellipse(720,320,60,28,0,0,Math.PI*2); ctx.fill();
    } else if (planetKey==='saturn') {
      for (let y=0; y<512; y++) { const band=Math.sin(y*0.06); let r,g,b; if(band>0.3){r=240;g=224;b=176;}else if(band>-0.3){r=216;g=184;b=120;}else{r=184;g=144;b=88;} for (let x=0; x<1024; x++) { const v=(Math.random()-0.5)*20|0; ctx.fillStyle=`rgb(${r+v},${g+v},${b+v})`; ctx.fillRect(x,y,1,1); } }
    } else if (planetKey==='uranus') {
      for (let y=0; y<512; y++) { const band=Math.sin(y*0.04)*0.3; const r=80+band*40|0,g=195+band*30|0,b=210+band*20|0; for (let x=0; x<1024; x++) { const v=(Math.random()-0.5)*15|0; ctx.fillStyle=`rgb(${r+v},${g+v},${b+v})`; ctx.fillRect(x,y,1,1); } }
    } else if (planetKey==='neptune') {
      for (let y=0; y<512; y++) { const band=Math.sin(y*0.05)*0.4; const r=20+band*15|0,g=50+band*20|0,b=160+band*40|0; for (let x=0; x<1024; x++) { const v=(Math.random()-0.5)*15|0; ctx.fillStyle=`rgb(${r+v},${g+v},${b+v})`; ctx.fillRect(x,y,1,1); } }
    } else { ctx.fillStyle='#888'; ctx.fillRect(0,0,1024,512); }

    const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace;
    planetSphere=new THREE.Mesh(new THREE.SphereGeometry(radius,64,64),
      new THREE.MeshStandardMaterial({map:tex,roughness:0.95,metalness:0,side:THREE.FrontSide}));
    planetSphere.position.set(0,-radius,0);
    planetSphere.visible=false;
    scene.add(planetSphere);
    if (['earth','jupiter','saturn','uranus','neptune'].includes(planetKey)) {
      const haloColor={earth:0x6ab4ff,jupiter:0xe8b878,saturn:0xf0d8a0,uranus:0x80d8f0,neptune:0x4060d0}[planetKey];
      const halo=new THREE.Mesh(new THREE.SphereGeometry(radius*1.04,48,48),
        new THREE.MeshBasicMaterial({color:haloColor,transparent:true,opacity:0.18,side:THREE.BackSide,depthWrite:false}));
      halo.position.copy(planetSphere.position); halo.visible=false;
      planetSphere.userData.halo=halo; scene.add(halo);
    }
  };

  // ===== Stars =====
  const buildStarsLayer = () => {
    const count=3000, geom=new THREE.BufferGeometry(), pos=new Float32Array(count*3);
    for (let i=0; i<count; i++) {
      const r=250000, theta=Math.random()*Math.PI*2, phi=Math.acos(2*Math.random()-1);
      pos[i*3]=r*Math.sin(phi)*Math.cos(theta); pos[i*3+1]=r*Math.sin(phi)*Math.sin(theta); pos[i*3+2]=r*Math.cos(phi);
    }
    geom.setAttribute('position',new THREE.BufferAttribute(pos,3));
    starsLayer=new THREE.Points(geom,new THREE.PointsMaterial({color:0xffffff,size:80,sizeAttenuation:true,transparent:true,opacity:cfg.hasStarsAlways?1.0:0}));
    scene.add(starsLayer);
  };

  // ===== Controls =====
  const setFlyMode = (on) => { flyMode=on; if(onModeChangeCb)onModeChangeCb(flyMode); if(on)velocity.set(0,20,0); };
  const setFlySpeed = (v) => { flySpeed=v; };

  const onKeyDown = (e) => {
    keys[e.code]=true;
    if (e.code==='KeyF') { setFlyMode(!flyMode); return; }
    if (!flyMode && e.code==='Space' && Math.abs(velocity.y)<0.1) velocity.y=cfg.jumpForce;
  };
  const onKeyUp = (e) => { keys[e.code]=false; };

  const onPointerDown = (e) => { isPointerDown=true; lastPointer.x=e.clientX; lastPointer.y=e.clientY; if(canvasEl)canvasEl.style.cursor='grabbing'; };
  const onPointerMove = (e) => {
    if (!isPointerDown) return;
    yaw -= (e.clientX-lastPointer.x)*0.003;
    pitch -= (e.clientY-lastPointer.y)*0.003;
    pitch = Math.max(-Math.PI/2+0.1, Math.min(Math.PI/2-0.1, pitch));
    lastPointer.x=e.clientX; lastPointer.y=e.clientY;
  };
  const onPointerUp = () => { isPointerDown=false; if(canvasEl)canvasEl.style.cursor='grab'; };
  const onResize = () => {
    if (!camera||!renderer) return;
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
  };

  const bindEvents = () => {
    window.addEventListener('keydown',onKeyDown);
    window.addEventListener('keyup',onKeyUp);
    canvasEl.addEventListener('pointerdown',onPointerDown);
    window.addEventListener('pointermove',onPointerMove);
    window.addEventListener('pointerup',onPointerUp);
    window.addEventListener('resize',onResize);
    canvasEl.style.cursor='grab';
  };
  const unbindEvents = () => {
    window.removeEventListener('keydown',onKeyDown);
    window.removeEventListener('keyup',onKeyUp);
    if (canvasEl) { canvasEl.removeEventListener('pointerdown',onPointerDown); canvasEl.style.cursor=''; }
    window.removeEventListener('pointermove',onPointerMove);
    window.removeEventListener('pointerup',onPointerUp);
    window.removeEventListener('resize',onResize);
  };

  // ===== Animate =====
  const animate = () => {
    animId=requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(), 0.08);

    // Wind (Neptune)
    if (windParticles) {
      const wp=windParticles.geometry.attributes.position;
      const wv=windParticles.geometry.userData.velocity;
      const bound=cfg.objRadius;
      for (let i=0; i<wp.count; i++) {
        let x=wp.getX(i)+wv[i*3]*dt, y=wp.getY(i)+wv[i*3+1]*dt, z=wp.getZ(i)+wv[i*3+2]*dt;
        if (x>bound) x-=bound*2; if (x<-bound) x+=bound*2;
        wp.setXYZ(i,x,y,z);
      }
      wp.needsUpdate=true;
    }

    // Movement
    if (flyMode) {
      const fwd=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
      const rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
      const move=new THREE.Vector3();
      if(keys['KeyW']||keys['ArrowUp'])   move.add(fwd);
      if(keys['KeyS']||keys['ArrowDown']) move.sub(fwd);
      if(keys['KeyA']||keys['ArrowLeft']) move.sub(rgt);
      if(keys['KeyD']||keys['ArrowRight'])move.add(rgt);
      if(keys['Space'])      move.y+=1;
      if(keys['ShiftLeft']||keys['ShiftRight']) move.y-=1;
      if(move.lengthSq()>0) move.normalize().multiplyScalar(flySpeed*dt);
      camera.position.add(move);
      const gy=getHeightAt(camera.position.x,camera.position.z)+1;
      if(camera.position.y<gy) camera.position.y=gy;
      velocity.set(0,0,0);
    } else {
      const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
      const rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
      const move=new THREE.Vector3();
      if(keys['KeyW']||keys['ArrowUp'])   move.add(fwd);
      if(keys['KeyS']||keys['ArrowDown']) move.sub(fwd);
      if(keys['KeyA']||keys['ArrowLeft']) move.sub(rgt);
      if(keys['KeyD']||keys['ArrowRight'])move.add(rgt);
      if(move.lengthSq()>0) move.normalize().multiplyScalar(cfg.moveSpeed*dt);
      camera.position.x+=move.x; camera.position.z+=move.z;
      velocity.y-=cfg.gravity*dt;
      camera.position.y+=velocity.y*dt;
      const gy=getHeightAt(camera.position.x,camera.position.z)+playerHeight;
      if(camera.position.y<gy){ camera.position.y=gy; velocity.y=0; }
    }

    // Look
    const dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(dir));
    if (sky) sky.position.copy(camera.position);

    // High-altitude effects — planet sphere shows at > 8000m
    const alt=camera.position.y;
    const fadeStart=8000, fadeEnd=40000;
    const t=cfg.hasStarsAlways?1.0:Math.max(0,Math.min(1,(alt-fadeStart)/(fadeEnd-fadeStart)));
    if(planetSphere){ planetSphere.visible=t>0.01; if(planetSphere.userData.halo){planetSphere.userData.halo.visible=t>0.01; planetSphere.userData.halo.material.opacity=0.18*t;} }
    if(starsLayer) starsLayer.material.opacity=cfg.hasStarsAlways?1.0:t;
    if(scene.fog&&!cfg.hasStarsAlways) scene.fog.far=cfg.fogFar*(1+t*3);
    if(sky&&sky.material.uniforms&&!cfg.hasStarsAlways){
      const tc=new THREE.Color(cfg.skyTop), bc=new THREE.Color(cfg.skyBottom);
      sky.material.uniforms.topColor.value.setRGB(tc.r*(1-t*0.9),tc.g*(1-t*0.9),tc.b*(1-t*0.9));
      sky.material.uniforms.bottomColor.value.setRGB(bc.r*(1-t*0.7),bc.g*(1-t*0.7),bc.b*(1-t*0.7));
    }

    if(window.updateWalkHUD) window.updateWalkHUD({x:camera.position.x,z:camera.position.z,elevation:camera.position.y-playerHeight,altitude:camera.position.y,yaw,planetKey,flyMode,flySpeed});
    renderer.render(scene,camera);
  };

  // ===== Dispose =====
  const dispose = () => {
    if(animId) cancelAnimationFrame(animId);
    unbindEvents();
    if(renderer){ renderer.dispose(); if(canvasEl&&canvasEl.parentNode)canvasEl.parentNode.removeChild(canvasEl); }
    scene=camera=renderer=canvasEl=null;
    groundMesh=sky=planetSphere=starsLayer=windParticles=null;
    keys={}; velocity=new THREE.Vector3(); isPointerDown=false; cachedCraters=[];
  };

  return {
    init, dispose,
    isAvailable: (key) => !!PLANET_CONFIG[key],
    getName:     (key) => PLANET_CONFIG[key]?.name || key,
    setFlyMode, setFlySpeed,
    isFlying:    () => flyMode,
    getFlySpeed: () => flySpeed,
    onModeChange:(cb) => { onModeChangeCb=cb; },
  };
})();
