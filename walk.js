// 行星表面漫遊模式 — 第一人稱視角 + Pointer Lock
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
  let pointerLocked = false;
  let overlayEl = null;
  let windParticles = null;
  let cachedCraters = [];

  const PLANET_CONFIG = {
    mercury: {
      name: '水星',
      gravity: 3.7,
      skyTop: 0x000000, skyBottom: 0x000000, skyColor: 0x000000,
      groundColor: 0x7a6a5a,
      fogColor: 0x000000, fogNear: 0, fogFar: 99999,
      ambientLight: 0xffffff, ambientIntensity: 0.18,
      sunColor: 0xffffff, sunIntensity: 4.5,
      hasWater: false, hasTrees: false, hasClouds: false,
      surfaceType: 'rocky',
      moveSpeed: 6, jumpForce: 9,
      hasStarsAlways: true,
    },
    venus: {
      name: '金星',
      gravity: 8.87,
      skyTop: 0x8a3010, skyBottom: 0xe09040, skyColor: 0xcc7020,
      groundColor: 0x5a2808,
      fogColor: 0xb06020, fogNear: 15, fogFar: 200,
      ambientLight: 0xff9040, ambientIntensity: 0.95,
      sunColor: 0xffcc80, sunIntensity: 0.35,
      hasWater: false, hasTrees: false, hasClouds: false,
      surfaceType: 'volcanic',
      moveSpeed: 8, jumpForce: 4,
    },
    earth: {
      name: '地球',
      gravity: 9.8,
      skyTop: 0x4477bb, skyBottom: 0xddeeff, skyColor: 0x88bbee,
      groundColor: 0x4a6e3a,
      fogColor: 0xb8d4ee, fogNear: 30, fogFar: 280,
      ambientLight: 0xffffff, ambientIntensity: 0.5,
      sunColor: 0xfff5e0, sunIntensity: 1.4,
      hasWater: true, hasTrees: true, hasClouds: true,
      surfaceType: 'grass',
      moveSpeed: 8, jumpForce: 5,
    },
    mars: {
      name: '火星',
      gravity: 3.7,
      skyTop: 0xc89568, skyBottom: 0xe8b88c, skyColor: 0xd9a579,
      groundColor: 0xa84a2a,
      fogColor: 0xc89070, fogNear: 40, fogFar: 350,
      ambientLight: 0xffd0a8, ambientIntensity: 0.55,
      sunColor: 0xffe0b8, sunIntensity: 1.0,
      hasWater: false, hasTrees: false, hasClouds: false,
      surfaceType: 'sand',
      moveSpeed: 8, jumpForce: 8,
    },
    jupiter: {
      name: '木星',
      gravity: 24.8,
      skyTop: 0x8a5a3a, skyBottom: 0xe6c896, skyColor: 0xd4a574,
      groundColor: 0xc89868,
      fogColor: 0xd4a574, fogNear: 60, fogFar: 600,
      ambientLight: 0xffd8a8, ambientIntensity: 0.65,
      sunColor: 0xfff0d8, sunIntensity: 0.6,
      hasWater: false, hasTrees: false, hasClouds: true,
      surfaceType: 'cloud',
      moveSpeed: 10, jumpForce: 4,
    },
    saturn: {
      name: '土星',
      gravity: 10.4,
      skyTop: 0xb89868, skyBottom: 0xf0e0b0, skyColor: 0xe8d4a0,
      groundColor: 0xc8a878,
      fogColor: 0xe0c898, fogNear: 60, fogFar: 600,
      ambientLight: 0xfff0d0, ambientIntensity: 0.65,
      sunColor: 0xfff0d8, sunIntensity: 0.45,
      hasWater: false, hasTrees: false, hasClouds: true,
      surfaceType: 'cloud', hasRings: true,
      moveSpeed: 10, jumpForce: 5,
    },
    uranus: {
      name: '天王星',
      gravity: 8.69,
      skyTop: 0x2a8098, skyBottom: 0x90d8e8, skyColor: 0x5ab8c8,
      groundColor: 0x70c0d0,
      fogColor: 0x70c8d8, fogNear: 100, fogFar: 800,
      ambientLight: 0xa0e8f8, ambientIntensity: 0.55,
      sunColor: 0xe0f0ff, sunIntensity: 0.08,
      hasWater: false, hasTrees: false, hasClouds: true,
      surfaceType: 'ice', hasRings: true,
      moveSpeed: 8, jumpForce: 6,
    },
    neptune: {
      name: '海王星',
      gravity: 11.15,
      skyTop: 0x020818, skyBottom: 0x0a1540, skyColor: 0x050c28,
      groundColor: 0x102040,
      fogColor: 0x071020, fogNear: 40, fogFar: 500,
      ambientLight: 0x5060d0, ambientIntensity: 0.4,
      sunColor: 0x8090ff, sunIntensity: 0.05,
      hasWater: false, hasTrees: false, hasClouds: false,
      surfaceType: 'storm',
      moveSpeed: 8, jumpForce: 5,
    },
  };

  // ===== Init =====
  const init = (containerEl, key) => {
    container = containerEl;
    planetKey = key;
    cfg = PLANET_CONFIG[key];
    if (!cfg) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.skyColor);
    if (cfg.fogFar < 10000) scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar);

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
    yaw = 0; pitch = 0;
    velocity.set(0, 0, 0);
    flyMode = false; flySpeed = 30;
    pointerLocked = false;
    windParticles = null; cachedCraters = [];

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
    buildOverlay();
    bindEvents();
    animate();
  };

  // ===== Sky =====
  const buildSky = () => {
    if (cfg.hasStarsAlways) { scene.background = new THREE.Color(0x000000); return; }
    const geom = new THREE.SphereGeometry(800, 32, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(cfg.skyTop) },
        bottomColor: { value: new THREE.Color(cfg.skyBottom) },
        offset: { value: 33 }, exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor; uniform vec3 bottomColor;
        uniform float offset; uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0),exponent),0.0)), 1.0);
        }`,
      side: THREE.BackSide,
    });
    sky = new THREE.Mesh(geom, mat);
    scene.add(sky);
  };

  // ===== Lights =====
  const buildLights = () => {
    scene.add(new THREE.AmbientLight(cfg.ambientLight, cfg.ambientIntensity));
    const sunLight = new THREE.DirectionalLight(cfg.sunColor, cfg.sunIntensity);
    sunLight.position.set(planetKey === 'mercury' ? 0 : 80, 120, planetKey === 'mercury' ? 0 : 50);
    scene.add(sunLight);

    const sunSize = planetKey === 'mercury' ? 24 : (planetKey === 'neptune' || planetKey === 'uranus' ? 2 : 8);
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(sunSize, 24, 24),
      new THREE.MeshBasicMaterial({ color: cfg.sunColor })
    );
    sunMesh.position.set(
      planetKey === 'mercury' ? 0 : 300,
      planetKey === 'mercury' ? 400 : 200,
      planetKey === 'mercury' ? 0 : 200
    );
    scene.add(sunMesh);

    if (planetKey === 'venus') {
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(780, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0xd08040, transparent: true, opacity: 0.35, side: THREE.BackSide, depthWrite: false })
      ));
    }
    if (planetKey === 'neptune') {
      const stormLight = new THREE.PointLight(0x4060ff, 0.5, 500);
      stormLight.position.set(0, 100, 0);
      scene.add(stormLight);
    }
  };

  // ===== Terrain dispatch =====
  const buildTerrain = () => {
    const t = cfg.surfaceType;
    if (t === 'cloud') buildGasGiantSurface();
    else if (t === 'rocky') buildRockyTerrain();
    else if (t === 'volcanic') buildVolcanicTerrain();
    else if (t === 'ice') buildIceTerrain();
    else if (t === 'storm') buildStormTerrain();
    else buildNaturalTerrain();
  };

  // grass / sand (Earth, Mars)
  const buildNaturalTerrain = () => {
    const size = 600, seg = 120;
    const geom = new THREE.PlaneGeometry(size, size, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = Math.sin(x*0.05)*Math.cos(z*0.04)*1.5 + Math.sin(x*0.12+1.3)*Math.cos(z*0.09)*0.6
              + Math.sin(x*0.3)*Math.cos(z*0.25)*0.25 + (Math.random()-0.5)*0.15;
      pos.setY(i, h);
    }
    geom.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(cfg.groundColor);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), v = (Math.random()-0.5)*0.18, lift = Math.max(0, y*0.08);
      const c = base.clone();
      c.r = Math.max(0,Math.min(1,c.r+v+lift)); c.g = Math.max(0,Math.min(1,c.g+v+lift*0.7)); c.b = Math.max(0,Math.min(1,c.b+v*0.5));
      if (planetKey==='earth') { if(y<-0.3)c.setRGB(0.25,0.4,0.2); else if(y>1.0)c.setRGB(0.45,0.38,0.28); }
      else { if(y>0.8)c.setRGB(c.r*1.1,c.g*0.9,c.b*0.8); }
      colors[i*3]=c.r; colors[i*3+1]=c.g; colors[i*3+2]=c.b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundMesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.95, metalness:0, flatShading:true }));
    scene.add(groundMesh);
    if (cfg.hasWater) {
      const w = new THREE.Mesh(
        Object.assign(new THREE.PlaneGeometry(size, size), { rotateX: function(a){THREE.PlaneGeometry.prototype.rotateX.call(this,a);return this;} }),
        new THREE.MeshStandardMaterial({ color:0x2a5a8a, transparent:true, opacity:0.7, roughness:0.3, metalness:0.4 })
      );
      const wg = new THREE.PlaneGeometry(size, size); wg.rotateX(-Math.PI/2);
      const water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color:0x2a5a8a, transparent:true, opacity:0.7, roughness:0.3, metalness:0.4 }));
      water.position.y = -0.6; scene.add(water);
    }
  };

  // Mercury: craters
  const buildRockyTerrain = () => {
    cachedCraters = [];
    for (let i = 0; i < 22; i++) {
      cachedCraters.push({ x:(Math.random()-0.5)*520, z:(Math.random()-0.5)*520, r:15+Math.random()*50, depth:1.5+Math.random()*5 });
    }
    const size = 600, seg = 100;
    const geom = new THREE.PlaneGeometry(size, size, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let h = (Math.random()-0.5)*0.3;
      cachedCraters.forEach(c => {
        const d = Math.sqrt((x-c.x)**2+(z-c.z)**2);
        if (d < c.r*1.35) {
          const t = d/c.r;
          if (t<=1.0) h += -c.depth*(1-t*t*0.7);
          else { const rt=(t-1.0)/0.35; h += c.depth*0.5*Math.max(0,1-rt)*Math.sin(rt*Math.PI); }
        }
      });
      pos.setY(i, h);
    }
    geom.computeVertexNormals();
    const colors = new Float32Array(pos.count*3);
    for (let i = 0; i < pos.count; i++) {
      const v=(Math.random()-0.5)*0.12;
      colors[i*3]=0.50+v; colors[i*3+1]=0.46+v; colors[i*3+2]=0.41+v;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundMesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1.0, metalness:0, flatShading:true }));
    scene.add(groundMesh);
  };

  // Venus: volcanic
  const buildVolcanicTerrain = () => {
    const size = 600, seg = 120;
    const geom = new THREE.PlaneGeometry(size, size, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x=pos.getX(i), z=pos.getZ(i);
      const h = Math.sin(x*0.04)*Math.cos(z*0.035)*3.5 + Math.sin(x*0.1+0.5)*Math.cos(z*0.08)*1.5
              + Math.sin(x*0.22)*Math.cos(z*0.18)*0.6 + (Math.random()-0.5)*0.4;
      pos.setY(i, h);
    }
    geom.computeVertexNormals();
    const colors = new Float32Array(pos.count*3);
    for (let i = 0; i < pos.count; i++) {
      const y=pos.getY(i), v=(Math.random()-0.5)*0.1;
      let r=0.22+v, g=0.10+v*0.5, b=0.04;
      if(y>3.0){r=0.55;g=0.22;b=0.05;}
      else if(y>1.5){r=0.38;g=0.15;b=0.04;}
      colors[i*3]=r; colors[i*3+1]=g; colors[i*3+2]=b;
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundMesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
      vertexColors:true, roughness:0.9, metalness:0.1, flatShading:true,
      emissive:new THREE.Color(0x200800), emissiveIntensity:0.5,
    }));
    scene.add(groundMesh);
    // lava cracks
    for (let i = 0; i < 14; i++) {
      const pts=[]; let sx=(Math.random()-0.5)*400, sz=(Math.random()-0.5)*400;
      for(let j=0;j<18;j++){
        pts.push(new THREE.Vector3(sx, getHeightAt(sx,sz)-0.05, sz));
        sx+=(Math.random()-0.5)*30; sz+=(Math.random()-0.5)*30;
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({color:0xff4400,transparent:true,opacity:0.9})));
    }
    // lava pools
    for (let i = 0; i < 10; i++) {
      const lx=(Math.random()-0.5)*400, lz=(Math.random()-0.5)*400;
      const pg = new THREE.CircleGeometry(2+Math.random()*7,16); pg.rotateX(-Math.PI/2);
      const pool = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({color:0xff3300,transparent:true,opacity:0.9}));
      pool.position.set(lx, getHeightAt(lx,lz)-0.2, lz);
      scene.add(pool);
    }
  };

  // Uranus: ice
  const buildIceTerrain = () => {
    const size = 800, seg = 120;
    const geom = new THREE.PlaneGeometry(size, size, seg, seg);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x=pos.getX(i), z=pos.getZ(i);
      const h = Math.sin(x*0.03)*Math.cos(z*0.025)*2.5 + Math.sin(x*0.08+1.0)*Math.cos(z*0.06)*0.8
              + Math.sin(x*0.2)*Math.cos(z*0.15)*0.3 + (Math.random()-0.5)*0.15;
      pos.setY(i, h);
    }
    geom.computeVertexNormals();
    const colors = new Float32Array(pos.count*3);
    for (let i = 0; i < pos.count; i++) {
      const y=pos.getY(i), v=(Math.random()-0.5)*0.07;
      let r=0.58+v, g=0.85+v, b=0.92+v;
      if(y>1.8){r=0.92;g=0.98;b=1.0;}
      colors[i*3]=Math.min(1,r); colors[i*3+1]=Math.min(1,g); colors[i*3+2]=Math.min(1,b);
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundMesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.35, metalness:0.25 }));
    scene.add(groundMesh);
    // ice boulders
    for (let i = 0; i < 45; i++) {
      const x=(Math.random()-0.5)*600, z=(Math.random()-0.5)*600, r=0.4+Math.random()*2.5;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(r,1),
        new THREE.MeshStandardMaterial({color:new THREE.Color(0x90d0e8).offsetHSL(0,0,(Math.random()-0.5)*0.1),roughness:0.3,metalness:0.3,flatShading:true})
      );
      rock.position.set(x, getHeightAt(x,z)+r*0.5, z);
      rock.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
      scene.add(rock);
    }
    // rings overhead
    if (cfg.hasRings) {
      const cv=document.createElement('canvas'); cv.width=512; cv.height=64;
      const ctx=cv.getContext('2d');
      for(let i=0;i<512;i++){
        const v=Math.sin(i*0.12)*0.3+0.5;
        ctx.fillStyle=`rgba(${Math.floor(160*v+60)},${Math.floor(210*v+20)},${Math.floor(220*v+10)},${(0.3+Math.random()*0.25).toFixed(2)})`;
        ctx.fillRect(i,0,1,64);
      }
      const rg=new THREE.RingGeometry(220,300,96,1);
      const ring=new THREE.Mesh(rg, new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),side:THREE.DoubleSide,transparent:true,opacity:0.55,depthWrite:false}));
      ring.rotation.z=Math.PI/2-THREE.MathUtils.degToRad(7.77);
      ring.position.set(0,200,-450);
      scene.add(ring);
    }
  };

  // Neptune: storm
  const buildStormTerrain = () => {
    const size=800, seg=120;
    const geom=new THREE.PlaneGeometry(size,size,seg,seg);
    geom.rotateX(-Math.PI/2);
    const pos=geom.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i);
      const h=Math.sin(x*0.025)*Math.cos(z*0.02)*3.5+Math.sin(x*0.07+1.5)*Math.cos(z*0.055)*1.5+(Math.random()-0.5)*0.5;
      pos.setY(i,h);
    }
    geom.computeVertexNormals();
    const colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      const y=pos.getY(i),v=(Math.random()-0.5)*0.06;
      let r=0.04+v, g=0.10+v, b=0.32+v;
      if(y>2.0){r=0.08;g=0.16;b=0.50;}
      colors[i*3]=Math.max(0,r);colors[i*3+1]=Math.max(0,g);colors[i*3+2]=Math.max(0,b);
    }
    geom.setAttribute('color',new THREE.BufferAttribute(colors,3));
    groundMesh=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.6,flatShading:true,emissive:new THREE.Color(0x000a1a),emissiveIntensity:0.4}));
    scene.add(groundMesh);
    // wind particles
    const count=2000;
    const wg=new THREE.BufferGeometry();
    const wPos=new Float32Array(count*3), wVel=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      wPos[i*3]=(Math.random()-0.5)*600; wPos[i*3+1]=Math.random()*80+2; wPos[i*3+2]=(Math.random()-0.5)*600;
      wVel[i*3]=60+Math.random()*80; wVel[i*3+1]=(Math.random()-0.5)*4; wVel[i*3+2]=(Math.random()-0.5)*15;
    }
    wg.setAttribute('position',new THREE.BufferAttribute(wPos,3));
    wg.userData.velocity=wVel;
    windParticles=new THREE.Points(wg,new THREE.PointsMaterial({color:0x8090ff,size:0.25,transparent:true,opacity:0.55,sizeAttenuation:true}));
    scene.add(windParticles);
  };

  // Gas giants
  const buildGasGiantSurface = () => {
    const size=1200,seg=180;
    const geom=new THREE.PlaneGeometry(size,size,seg,seg);
    geom.rotateX(-Math.PI/2);
    const pos=geom.attributes.position;
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i);
      const h=Math.sin(x*0.02)*Math.cos(z*0.018)*6+Math.sin(x*0.05+1.0)*Math.cos(z*0.04)*2.5+Math.sin(x*0.12)*0.6;
      pos.setY(i,h);
    }
    geom.computeVertexNormals();
    const colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i);
      const band=Math.sin(z*0.025+Math.sin(x*0.01)*0.6);
      let c;
      if(planetKey==='jupiter'){
        if(band>0.4)c=new THREE.Color(0xe8c89a); else if(band>0)c=new THREE.Color(0xc89868);
        else if(band>-0.4)c=new THREE.Color(0xa05838); else c=new THREE.Color(0xd8a878);
        const dr=Math.sqrt((x-200)**2+(z-100)**2);
        if(dr<80)c.lerp(new THREE.Color(0xb04020),Math.max(0,1-dr/80)*0.7);
      } else {
        if(band>0.3)c=new THREE.Color(0xf0e0b0); else if(band>-0.3)c=new THREE.Color(0xd8b878); else c=new THREE.Color(0xb89058);
      }
      const v=(Math.random()-0.5)*0.06;
      c.r=Math.max(0,Math.min(1,c.r+v));c.g=Math.max(0,Math.min(1,c.g+v));c.b=Math.max(0,Math.min(1,c.b+v));
      colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
    }
    geom.setAttribute('color',new THREE.BufferAttribute(colors,3));
    groundMesh=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1.0,flatShading:false}));
    scene.add(groundMesh);
    for(let i=0;i<60;i++){
      const cloud=new THREE.Group();
      const n=4+Math.floor(Math.random()*5);
      const baseColor=planetKey==='jupiter'?(Math.random()>0.5?0xeed8b0:0xc89868):(Math.random()>0.5?0xf0e0c0:0xd8b878);
      for(let j=0;j<n;j++){
        const r=8+Math.random()*12;
        const m=new THREE.Mesh(new THREE.SphereGeometry(r,10,10),new THREE.MeshBasicMaterial({color:baseColor,transparent:true,opacity:0.65}));
        m.position.set(j*10-n*5,(Math.random()-0.5)*4,(Math.random()-0.5)*8);
        cloud.add(m);
      }
      cloud.position.set((Math.random()-0.5)*1000,20+Math.random()*80,(Math.random()-0.5)*1000);
      scene.add(cloud);
    }
    if(cfg.hasRings){
      const cv=document.createElement('canvas');cv.width=512;cv.height=64;
      const ctx=cv.getContext('2d');
      for(let i=0;i<512;i++){const v=Math.sin(i*0.08)*0.3+Math.sin(i*0.21)*0.2+0.6;const a=0.4+Math.random()*0.4;ctx.fillStyle=`rgba(${Math.floor(230*v)},${Math.floor(210*v)},${Math.floor(170*v)},${a.toFixed(2)})`;ctx.fillRect(i,0,1,64);}
      ctx.fillStyle='rgba(0,0,0,0.85)';ctx.fillRect(340,0,12,64);
      const rg=new THREE.RingGeometry(180,320,96,1);
      const ring=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cv),side:THREE.DoubleSide,transparent:true,opacity:0.85,depthWrite:false}));
      ring.rotation.x=Math.PI/2-0.3;ring.position.set(0,250,-400);scene.add(ring);
    }
    if(planetKey==='jupiter'){
      const moon=new THREE.Mesh(new THREE.SphereGeometry(15,16,16),new THREE.MeshBasicMaterial({color:0xc8b890}));
      moon.position.set(-300,180,-350);scene.add(moon);
    }
  };

  // ===== Height =====
  const getHeightAt = (x, z) => {
    switch(cfg.surfaceType){
      case 'cloud': return Math.sin(x*0.02)*Math.cos(z*0.018)*6+Math.sin(x*0.05+1.0)*Math.cos(z*0.04)*2.5;
      case 'rocky': {
        let h=(Math.sin(x*0.02)*Math.cos(z*0.018))*0.5;
        cachedCraters.forEach(c=>{
          const d=Math.sqrt((x-c.x)**2+(z-c.z)**2);
          if(d<c.r*1.35){const t=d/c.r;if(t<=1.0)h+=-c.depth*(1-t*t*0.7);else{const rt=(t-1.0)/0.35;h+=c.depth*0.5*Math.max(0,1-rt)*Math.sin(rt*Math.PI);}}
        });
        return h;
      }
      case 'volcanic': return Math.sin(x*0.04)*Math.cos(z*0.035)*3.5+Math.sin(x*0.1+0.5)*Math.cos(z*0.08)*1.5;
      case 'ice': return Math.sin(x*0.03)*Math.cos(z*0.025)*2.5+Math.sin(x*0.08+1.0)*Math.cos(z*0.06)*0.8;
      case 'storm': return Math.sin(x*0.025)*Math.cos(z*0.02)*3.5+Math.sin(x*0.07+1.5)*Math.cos(z*0.055)*1.5;
      default: return Math.sin(x*0.05)*Math.cos(z*0.04)*1.5+Math.sin(x*0.12+1.3)*Math.cos(z*0.09)*0.6+Math.sin(x*0.3)*Math.cos(z*0.25)*0.25;
    }
  };

  // ===== Trees =====
  const buildTrees = () => {
    const tg=new THREE.Group();
    for(let i=0;i<80;i++){
      const x=(Math.random()-0.5)*400,z=(Math.random()-0.5)*400,y=getHeightAt(x,z);
      if(y<-0.2)continue;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,2.5,6),new THREE.MeshStandardMaterial({color:0x4a3520,roughness:0.9}));
      trunk.position.set(x,y+1.25,z); tg.add(trunk);
      const leaves=new THREE.Mesh(new THREE.ConeGeometry(1.5,3.5,8),new THREE.MeshStandardMaterial({color:new THREE.Color(0x2a5a2a).offsetHSL(0,0,(Math.random()-0.5)*0.1),roughness:0.9,flatShading:true}));
      leaves.position.set(x,y+4,z); tg.add(leaves);
    }
    scene.add(tg);
  };

  // ===== Rocks =====
  const buildRocks = () => {
    let count, baseHex;
    if(cfg.surfaceType==='rocky'){count=300;baseHex=0x7a6a5a;}
    else if(cfg.surfaceType==='volcanic'){count=80;baseHex=0x4a2010;}
    else if(planetKey==='mars'){count=200;baseHex=0x7a3a20;}
    else if(planetKey==='earth'){count=60;baseHex=0x6a6055;}
    else return;
    for(let i=0;i<count;i++){
      const x=(Math.random()-0.5)*500,z=(Math.random()-0.5)*500,y=getHeightAt(x,z);
      if(planetKey==='earth'&&y<-0.2)continue;
      const r=Math.random()*1.2+0.3;
      const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),new THREE.MeshStandardMaterial({color:new THREE.Color(baseHex).offsetHSL(0,0,(Math.random()-0.5)*0.15),roughness:0.95,flatShading:true}));
      rock.position.set(x,y+r*0.5,z);
      rock.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
      scene.add(rock);
    }
  };

  // ===== Clouds =====
  const buildClouds = () => {
    const cloudColor = planetKey==='uranus' ? 0xb0e8f0 : 0xffffff;
    const opacity = planetKey==='uranus' ? 0.5 : 0.7;
    for(let i=0;i<25;i++){
      const cloud=new THREE.Group();
      const n=3+Math.floor(Math.random()*4);
      for(let j=0;j<n;j++){
        const r=4+Math.random()*4;
        const m=new THREE.Mesh(new THREE.SphereGeometry(r,8,8),new THREE.MeshBasicMaterial({color:cloudColor,transparent:true,opacity}));
        m.position.set(j*6-n*3,0,(Math.random()-0.5)*4); cloud.add(m);
      }
      cloud.position.set((Math.random()-0.5)*700,65+Math.random()*35,(Math.random()-0.5)*700);
      scene.add(cloud);
    }
  };

  // ===== Horizon =====
  const buildHorizonObjects = () => {
    if(cfg.surfaceType==='cloud') return;
    const mtnCount=16;
    for(let i=0;i<mtnCount;i++){
      const angle=(i/mtnCount)*Math.PI*2+Math.random()*0.3;
      const dist=300+Math.random()*80;
      let h, r, baseColor;
      if(planetKey==='mercury'){r=35+Math.random()*25;h=12+Math.random()*18;baseColor=0x7a6a5a;}
      else if(planetKey==='venus'){r=28+Math.random()*22;h=50+Math.random()*70;baseColor=0x3a1808;}
      else if(planetKey==='uranus'){r=40+Math.random()*25;h=35+Math.random()*45;baseColor=0x50a0b8;}
      else if(planetKey==='neptune'){r=45+Math.random()*30;h=40+Math.random()*50;baseColor=0x0a1830;}
      else if(planetKey==='mars'){r=30+Math.random()*20;h=25+Math.random()*30;baseColor=0x6a2a18;}
      else {r=30+Math.random()*20;h=25+Math.random()*30;baseColor=0x5a6a55;}
      const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(baseColor).offsetHSL(0,0,(Math.random()-0.5)*0.1),roughness:1.0,flatShading:true});
      if(planetKey==='venus')mat.emissive=new THREE.Color(0x0a0200),mat.emissiveIntensity=0.2;
      const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,5+Math.floor(Math.random()*3)),mat);
      m.position.set(Math.cos(angle)*dist,h/2-2,Math.sin(angle)*dist);
      scene.add(m);
    }
    if(planetKey==='mars'){const e=new THREE.Mesh(new THREE.SphereGeometry(0.5,8,8),new THREE.MeshBasicMaterial({color:0x88bbff}));e.position.set(150,80,-200);scene.add(e);}
    if(planetKey==='earth'){const mo=new THREE.Mesh(new THREE.SphereGeometry(6,16,16),new THREE.MeshBasicMaterial({color:0xeeeedd}));mo.position.set(-200,120,-250);scene.add(mo);}
    if(planetKey==='uranus'){const ti=new THREE.Mesh(new THREE.SphereGeometry(4,16,16),new THREE.MeshBasicMaterial({color:0xb0a898}));ti.position.set(-250,150,-300);scene.add(ti);}
    if(planetKey==='neptune'){const tr=new THREE.Mesh(new THREE.SphereGeometry(3,16,16),new THREE.MeshBasicMaterial({color:0xc0b8a8}));tr.position.set(200,100,-250);scene.add(tr);}
  };

  // ===== Planet sphere (high altitude) =====
  const buildPlanetSphere = () => {
    const radius=6000;
    const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=512;
    const ctx=canvas.getContext('2d');
    if(planetKey==='earth'){
      ctx.fillStyle='#1f4f8c';ctx.fillRect(0,0,1024,512);
      ctx.fillStyle='#3a6e3a';
      for(let i=0;i<12;i++){const x=Math.random()*1024,y=80+Math.random()*350,r=40+Math.random()*90;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=0.55;ctx.fillStyle='#ffffff';
      for(let i=0;i<80;i++){const x=Math.random()*1024,y=Math.random()*512,r=10+Math.random()*30;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;ctx.fillStyle='#e8f0ff';ctx.fillRect(0,0,1024,30);ctx.fillRect(0,482,1024,30);
    } else if(planetKey==='mars'){
      ctx.fillStyle='#a84a2a';ctx.fillRect(0,0,1024,512);
      for(let i=0;i<5000;i++){const x=Math.random()*1024,y=Math.random()*512,v=(Math.random()-0.5)*50;ctx.fillStyle=`rgb(${Math.floor(168+v)},${Math.floor(74+v*0.5)},${Math.floor(42+v*0.3)})`;ctx.fillRect(x,y,2,2);}
      ctx.fillStyle='#e8d8c0';ctx.fillRect(0,0,1024,25);ctx.fillRect(0,487,1024,25);
    } else if(planetKey==='mercury'){
      ctx.fillStyle='#6a5a48';ctx.fillRect(0,0,1024,512);
      for(let i=0;i<30;i++){const x=Math.random()*1024,y=Math.random()*512,r=15+Math.random()*50;ctx.fillStyle=`rgba(0,0,0,${(0.3+Math.random()*0.4).toFixed(2)})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    } else if(planetKey==='venus'){
      for(let y=0;y<512;y++){const band=Math.sin(y*0.03+Math.cos(y*0.007)*3);const r=Math.floor(180+band*30),g=Math.floor(100+band*20),b=Math.floor(20+band*10);for(let x=0;x<1024;x++){const v=(Math.random()-0.5)*20;ctx.fillStyle=`rgb(${r+v|0},${g+v*0.5|0},${b|0})`;ctx.fillRect(x,y,1,1);}}
    } else if(planetKey==='jupiter'){
      for(let y=0;y<512;y++){const band=Math.sin(y*0.05);let r,g,b;if(band>0.4){r=232;g=200;b=154;}else if(band>0){r=200;g=152;b=104;}else if(band>-0.4){r=160;g=88;b=56;}else{r=216;g=168;b=120;}for(let x=0;x<1024;x++){const v=(Math.random()-0.5)*30+Math.sin(x*0.05+y*0.02)*15;ctx.fillStyle=`rgb(${r+v|0},${g+v|0},${b+v|0})`;ctx.fillRect(x,y,1,1);}}
      ctx.fillStyle='rgba(180,60,40,0.85)';ctx.beginPath();ctx.ellipse(720,320,60,28,0,0,Math.PI*2);ctx.fill();
    } else if(planetKey==='saturn'){
      for(let y=0;y<512;y++){const band=Math.sin(y*0.06);let r,g,b;if(band>0.3){r=240;g=224;b=176;}else if(band>-0.3){r=216;g=184;b=120;}else{r=184;g=144;b=88;}for(let x=0;x<1024;x++){const v=(Math.random()-0.5)*20;ctx.fillStyle=`rgb(${r+v|0},${g+v|0},${b+v|0})`;ctx.fillRect(x,y,1,1);}}
    } else if(planetKey==='uranus'){
      for(let y=0;y<512;y++){const band=Math.sin(y*0.04)*0.3;const r=Math.floor(80+band*40),g=Math.floor(195+band*30),b=Math.floor(210+band*20);for(let x=0;x<1024;x++){const v=(Math.random()-0.5)*15;ctx.fillStyle=`rgb(${r+v|0},${g+v|0},${b+v|0})`;ctx.fillRect(x,y,1,1);}}
    } else if(planetKey==='neptune'){
      for(let y=0;y<512;y++){const band=Math.sin(y*0.05)*0.4;const r=Math.floor(20+band*15),g=Math.floor(50+band*20),b=Math.floor(160+band*40);for(let x=0;x<1024;x++){const v=(Math.random()-0.5)*15;ctx.fillStyle=`rgb(${r+v|0},${g+v|0},${b+v|0})`;ctx.fillRect(x,y,1,1);}}
    } else {ctx.fillStyle='#888';ctx.fillRect(0,0,1024,512);}

    const tex=new THREE.CanvasTexture(canvas);
    tex.colorSpace=THREE.SRGBColorSpace;
    planetSphere=new THREE.Mesh(new THREE.SphereGeometry(radius,64,64),new THREE.MeshStandardMaterial({map:tex,roughness:0.95,metalness:0,side:THREE.FrontSide}));
    planetSphere.position.set(0,-radius,0);
    planetSphere.visible=false;
    scene.add(planetSphere);

    if(['earth','jupiter','saturn','uranus','neptune'].includes(planetKey)){
      const haloColor={earth:0x6ab4ff,jupiter:0xe8b878,saturn:0xf0d8a0,uranus:0x80d8f0,neptune:0x4060d0}[planetKey];
      const halo=new THREE.Mesh(new THREE.SphereGeometry(radius*1.04,48,48),new THREE.MeshBasicMaterial({color:haloColor,transparent:true,opacity:0.18,side:THREE.BackSide,depthWrite:false}));
      halo.position.copy(planetSphere.position);halo.visible=false;
      planetSphere.userData.halo=halo;scene.add(halo);
    }
  };

  // ===== Stars =====
  const buildStarsLayer = () => {
    const count=2500;
    const geom=new THREE.BufferGeometry();
    const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const r=60000,theta=Math.random()*Math.PI*2,phi=Math.acos(2*Math.random()-1);
      positions[i*3]=r*Math.sin(phi)*Math.cos(theta);
      positions[i*3+1]=r*Math.sin(phi)*Math.sin(theta);
      positions[i*3+2]=r*Math.cos(phi);
    }
    geom.setAttribute('position',new THREE.BufferAttribute(positions,3));
    starsLayer=new THREE.Points(geom,new THREE.PointsMaterial({color:0xffffff,size:30,sizeAttenuation:true,transparent:true,opacity:cfg.hasStarsAlways?1.0:0}));
    scene.add(starsLayer);
  };

  // ===== Pointer Lock Overlay =====
  const buildOverlay = () => {
    overlayEl=document.createElement('div');
    overlayEl.className='walk-pointer-overlay';
    overlayEl.innerHTML='<div class="walk-pointer-msg"><div class="walk-pointer-title">點擊畫面開始漫遊</div><div class="walk-pointer-sub">移動滑鼠環顧四周 · ESC 暫停</div></div>';
    overlayEl.addEventListener('click', onClick);
    container.appendChild(overlayEl);
  };

  // ===== Controls =====
  const setFlyMode = (on) => {
    flyMode=on;
    if(onModeChangeCb)onModeChangeCb(flyMode);
    if(on)velocity.set(0,15,0);
  };
  const setFlySpeed = (v) => { flySpeed=v; };

  const onKeyDown = (e) => {
    keys[e.code]=true;
    if(e.code==='KeyF'){setFlyMode(!flyMode);return;}
    if(!flyMode&&e.code==='Space'&&Math.abs(velocity.y)<0.01) velocity.y=cfg.jumpForce;
  };
  const onKeyUp = (e) => { keys[e.code]=false; };

  const onPointerLockChange = () => {
    pointerLocked=(document.pointerLockElement===canvasEl);
    if(overlayEl) overlayEl.style.display=pointerLocked?'none':'flex';
  };
  const onPointerMove = (e) => {
    if(!pointerLocked)return;
    yaw-=e.movementX*0.002;
    pitch-=e.movementY*0.002;
    pitch=Math.max(-Math.PI/2+0.1,Math.min(Math.PI/2-0.1,pitch));
  };
  const onClick = () => { if(!pointerLocked&&canvasEl) canvasEl.requestPointerLock(); };
  const onResize = () => {
    if(!camera||!renderer)return;
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
  };

  const bindEvents = () => {
    window.addEventListener('keydown',onKeyDown);
    window.addEventListener('keyup',onKeyUp);
    canvasEl.addEventListener('click',onClick);
    document.addEventListener('pointerlockchange',onPointerLockChange);
    window.addEventListener('pointermove',onPointerMove);
    window.addEventListener('resize',onResize);
  };
  const unbindEvents = () => {
    window.removeEventListener('keydown',onKeyDown);
    window.removeEventListener('keyup',onKeyUp);
    if(canvasEl)canvasEl.removeEventListener('click',onClick);
    document.removeEventListener('pointerlockchange',onPointerLockChange);
    window.removeEventListener('pointermove',onPointerMove);
    window.removeEventListener('resize',onResize);
  };

  // ===== Animate =====
  const animate = () => {
    animId=requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),0.1);

    // Wind particles (Neptune)
    if(windParticles){
      const wp=windParticles.geometry.attributes.position;
      const wv=windParticles.geometry.userData.velocity;
      for(let i=0;i<wp.count;i++){
        let x=wp.getX(i)+wv[i*3]*dt, y=wp.getY(i)+wv[i*3+1]*dt, z=wp.getZ(i)+wv[i*3+2]*dt;
        if(x>300)x-=600; if(x<-300)x+=600;
        wp.setXYZ(i,x,y,z);
      }
      wp.needsUpdate=true;
    }

    if(flyMode){
      const fwd=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
      const rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
      const move=new THREE.Vector3();
      if(keys['KeyW']||keys['ArrowUp'])move.add(fwd);
      if(keys['KeyS']||keys['ArrowDown'])move.sub(fwd);
      if(keys['KeyA']||keys['ArrowLeft'])move.sub(rgt);
      if(keys['KeyD']||keys['ArrowRight'])move.add(rgt);
      if(keys['Space'])move.y+=1;
      if(keys['ShiftLeft']||keys['ShiftRight'])move.y-=1;
      if(move.lengthSq()>0)move.normalize().multiplyScalar(flySpeed*dt);
      camera.position.add(move);
      const gy=getHeightAt(camera.position.x,camera.position.z)+0.5;
      if(camera.position.y<gy)camera.position.y=gy;
      velocity.set(0,0,0);
    } else {
      const spd=cfg.moveSpeed;
      const fwd=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
      const rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
      const move=new THREE.Vector3();
      if(keys['KeyW']||keys['ArrowUp'])move.add(fwd);
      if(keys['KeyS']||keys['ArrowDown'])move.sub(fwd);
      if(keys['KeyA']||keys['ArrowLeft'])move.sub(rgt);
      if(keys['KeyD']||keys['ArrowRight'])move.add(rgt);
      if(move.lengthSq()>0)move.normalize().multiplyScalar(spd*dt);
      camera.position.x+=move.x; camera.position.z+=move.z;
      velocity.y-=cfg.gravity*dt;
      camera.position.y+=velocity.y*dt;
      const gy=getHeightAt(camera.position.x,camera.position.z)+playerHeight;
      if(camera.position.y<gy){camera.position.y=gy;velocity.y=0;}
    }

    const dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(dir));

    const alt=camera.position.y;
    const t=cfg.hasStarsAlways?1.0:Math.max(0,Math.min(1,(alt-150)/650));
    if(planetSphere){
      planetSphere.visible=t>0.01;
      if(planetSphere.userData.halo){planetSphere.userData.halo.visible=t>0.01;planetSphere.userData.halo.material.opacity=0.18*t;}
    }
    if(starsLayer)starsLayer.material.opacity=cfg.hasStarsAlways?1.0:t;
    if(scene.fog&&!cfg.hasStarsAlways)scene.fog.far=cfg.fogFar+t*8000;
    if(sky&&sky.material.uniforms&&!cfg.hasStarsAlways){
      const tc=new THREE.Color(cfg.skyTop), bc=new THREE.Color(cfg.skyBottom);
      sky.material.uniforms.topColor.value.setRGB(tc.r*(1-t),tc.g*(1-t),tc.b*(1-t));
      sky.material.uniforms.bottomColor.value.setRGB(bc.r*(1-t*0.8),bc.g*(1-t*0.8),bc.b*(1-t*0.8));
    }

    if(window.updateWalkHUD){
      window.updateWalkHUD({x:camera.position.x,z:camera.position.z,elevation:camera.position.y-playerHeight,altitude:camera.position.y,yaw,planetKey,flyMode,flySpeed});
    }
    renderer.render(scene,camera);
  };

  // ===== Dispose =====
  const dispose = () => {
    if(animId)cancelAnimationFrame(animId);
    unbindEvents();
    if(document.pointerLockElement===canvasEl)document.exitPointerLock();
    if(overlayEl){overlayEl.removeEventListener('click',onClick);if(overlayEl.parentNode)overlayEl.parentNode.removeChild(overlayEl);overlayEl=null;}
    if(renderer){renderer.dispose();if(canvasEl&&canvasEl.parentNode)canvasEl.parentNode.removeChild(canvasEl);}
    scene=camera=renderer=canvasEl=null;
    groundMesh=sky=planetSphere=starsLayer=windParticles=null;
    keys={};velocity=new THREE.Vector3();pointerLocked=false;cachedCraters=[];
  };

  return {
    init, dispose,
    isAvailable: (key) => !!PLANET_CONFIG[key],
    getName: (key) => PLANET_CONFIG[key]?.name || key,
    setFlyMode, setFlySpeed,
    isFlying: () => flyMode,
    getFlySpeed: () => flySpeed,
    onModeChange: (cb) => { onModeChangeCb=cb; },
  };
})();
