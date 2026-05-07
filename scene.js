// 太陽系 3D 場景
window.SolarSystem = (function() {
  let scene, camera, renderer, controls;
  let sun, sunGlow, sunCorona;
  let planetObjs = []; // {data, group, mesh, orbitLine, label, moons:[{data, group, mesh, orbitLine}]}
  let starField;
  let raycaster, mouse;
  let simulationDate = new Date('2026-01-01T00:00:00Z');
  let speed = 10; // 1 秒 = ? 天
  let playing = true;
  let scaleMode = 'edu'; // 'edu' or 'real'
  let showOrbits = true;
  let showLabels = true;
  let onPlanetClick = null;
  let canvasEl, container;
  let clock;

  const init = (containerEl) => {
    // 若已初始化，僅將既有 canvas 重新掛到新容器並恢復事件
    if (renderer && canvasEl) {
      container = containerEl;
      if (canvasEl.parentNode !== containerEl) containerEl.appendChild(canvasEl);
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }
      return;
    }
    container = containerEl;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005);

    // 環境光
    const ambient = new THREE.AmbientLight(0x222233, 0.6);
    scene.add(ambient);

    // 太陽光源
    const sunLight = new THREE.PointLight(0xffeecc, 3, 0, 0);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 60, 140);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    canvasEl = renderer.domElement;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 4000;
    controls.enablePan = true;
    // 預設：左鍵旋轉，右鍵平移
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    clock = new THREE.Clock();

    buildStarField();
    buildSun();
    buildPlanets();

    window.addEventListener('resize', onResize);
    canvasEl.addEventListener('click', onClick);

    animate();
  };

  const buildStarField = () => {
    // 5000 顆星星
    const starCount = 5000;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // 球面分佈
      const r = 3000 + Math.random() * 500;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      // 顏色（白、藍、橘、黃）
      const tint = Math.random();
      if (tint < 0.7) {
        colors[i * 3] = 1; colors[i * 3 + 1] = 1; colors[i * 3 + 2] = 1;
      } else if (tint < 0.85) {
        colors[i * 3] = 0.7; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 1;
      } else if (tint < 0.95) {
        colors[i * 3] = 1; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.6;
      } else {
        colors[i * 3] = 1; colors[i * 3 + 1] = 0.6; colors[i * 3 + 2] = 0.5;
      }
      sizes[i] = Math.random() * 2 + 0.5;
      phases[i] = Math.random() * Math.PI * 2;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float size;
        attribute float phase;
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uTime;
        void main() {
          vColor = color;
          vTwinkle = 0.6 + 0.4 * sin(uTime * 2.0 + phase);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d) * vTwinkle;
          gl_FragColor = vec4(vColor, a);
        }
      `,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
    });

    starField = new THREE.Points(geom, mat);
    scene.add(starField);
  };

  const buildSun = () => {
    const data = SOLAR_DATA.sun;
    const sunGroup = new THREE.Group();

    // 本體
    const tex = makeTexture('sun', data.color);
    const geom = new THREE.SphereGeometry(data.radiusEdu, 64, 64);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    sun = new THREE.Mesh(geom, mat);
    sun.userData = { type: 'sun', data };
    sunGroup.add(sun);

    // 光暈（多層 sprite 模擬）
    const glowTex = makeGlowTexture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffaa44,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    sunGlow = new THREE.Sprite(glowMat);
    sunGlow.scale.set(data.radiusEdu * 5, data.radiusEdu * 5, 1);
    sunGroup.add(sunGlow);

    // 外層光暈
    const coronaMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xff7722,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    sunCorona = new THREE.Sprite(coronaMat);
    sunCorona.scale.set(data.radiusEdu * 9, data.radiusEdu * 9, 1);
    sunGroup.add(sunCorona);

    scene.add(sunGroup);
    sun.userData.group = sunGroup;
  };

  const makeGlowTexture = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,255,200,1)');
    grad.addColorStop(0.2, 'rgba(255,200,100,0.7)');
    grad.addColorStop(0.5, 'rgba(255,140,40,0.25)');
    grad.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  };

  const buildPlanets = () => {
    SOLAR_DATA.planets.forEach(p => {
      const group = new THREE.Group();
      scene.add(group);

      const radius = p.radiusEdu;
      const tex = makeTexture(p.texture, p.color);
      const geom = new THREE.SphereGeometry(radius, 48, 48);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0.0,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData = { type: 'planet', data: p };
      // 軸傾斜
      mesh.rotation.z = THREE.MathUtils.degToRad(p.tilt);
      group.add(mesh);

      // 環
      let ringMesh = null;
      if (p.hasRings) {
        const inner = radius * p.ringInner;
        const outer = radius * p.ringOuter;
        const ringGeom = new THREE.RingGeometry(inner, outer, 128);
        // 修 UV 讓貼圖徑向呈現
        const pos = ringGeom.attributes.position;
        const uv = ringGeom.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(pos, i);
          const r = v.length();
          uv.setXY(i, (r - inner) / (outer - inner), 1);
        }
        const ringTex = makeRingTexture();
        const ringMat = new THREE.MeshBasicMaterial({
          map: ringTex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: p.ringOpacity || 0.85,
          depthWrite: false,
        });
        ringMesh = new THREE.Mesh(ringGeom, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.rotation.y = THREE.MathUtils.degToRad(p.tilt);
        group.add(ringMesh);
      }

      // 軌道線
      const orbitLine = makeOrbitLine(p.distanceEdu, 256, 0x444466);
      scene.add(orbitLine);

      // 衛星
      const moonObjs = [];
      p.moons.forEach(m => {
        const moonGroup = new THREE.Group();
        group.add(moonGroup);
        const mTex = makeTexture('moon', m.color);
        const mGeom = new THREE.SphereGeometry(m.radius, 24, 24);
        const mMat = new THREE.MeshStandardMaterial({
          map: mTex,
          color: m.color,
          roughness: 0.95,
          metalness: 0.0,
        });
        const mMesh = new THREE.Mesh(mGeom, mMat);
        mMesh.userData = { type: 'moon', data: m, parent: p };
        moonGroup.add(mMesh);

        // 衛星軌道線
        const mOrbit = makeOrbitLine(m.distance, 64, 0x333344);
        group.add(mOrbit);

        moonObjs.push({ data: m, group: moonGroup, mesh: mMesh, orbitLine: mOrbit });
      });

      planetObjs.push({
        data: p,
        group,
        mesh,
        ringMesh,
        orbitLine,
        moons: moonObjs,
      });
    });
  };

  const makeOrbitLine = (radius, segments, color) => {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 });
    return new THREE.Line(geom, mat);
  };

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  const onClick = (e) => {
    const rect = canvasEl.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const candidates = [sun];
    planetObjs.forEach(po => {
      candidates.push(po.mesh);
      po.moons.forEach(mo => candidates.push(mo.mesh));
    });

    const hits = raycaster.intersectObjects(candidates, false);
    if (hits.length > 0) {
      const obj = hits[0].object;
      if (onPlanetClick) onPlanetClick(obj.userData);
    } else {
      if (onPlanetClick) onPlanetClick(null);
    }
  };

  const animate = () => {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    // 更新模擬時間
    if (playing) {
      const days = dt * speed;
      simulationDate = new Date(simulationDate.getTime() + days * 86400000);
    }

    // 太陽脈動
    if (sun) {
      const t = clock.elapsedTime;
      const pulse = 1 + Math.sin(t * 1.5) * 0.015;
      sun.scale.setScalar(pulse);
      sunGlow.scale.set(SOLAR_DATA.sun.radiusEdu * (4.8 + Math.sin(t * 1.5) * 0.3), SOLAR_DATA.sun.radiusEdu * (4.8 + Math.sin(t * 1.5) * 0.3), 1);
      sunCorona.scale.set(SOLAR_DATA.sun.radiusEdu * (8.5 + Math.sin(t * 0.8) * 0.6), SOLAR_DATA.sun.radiusEdu * (8.5 + Math.sin(t * 0.8) * 0.6), 1);
      sun.rotation.y += dt * (1 / SOLAR_DATA.sun.rotationPeriod) * speed * 0.5;
    }

    // 星空閃爍
    if (starField && starField.material.uniforms) {
      starField.material.uniforms.uTime.value = clock.elapsedTime;
    }

    // 更新行星
    const totalDays = (simulationDate - new Date('2000-01-01T00:00:00Z')) / 86400000;
    planetObjs.forEach(po => {
      const p = po.data;
      const dist = scaleMode === 'edu' ? p.distanceEdu : Math.log10(p.distanceReal + 1) * 35;
      // 公轉
      const angle = (totalDays / p.orbitalPeriod) * Math.PI * 2;
      po.group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
      // 自轉
      po.mesh.rotation.y += dt * (24 / (p.rotationPeriod * 24)) * speed * 0.5;
      // 軌道線位置 & 大小
      const positions = po.orbitLine.geometry.attributes.position;
      const targetRadius = dist;
      // 只在切換比例時重建；簡化：每幀檢查
      if (Math.abs(po.orbitLine.userData?.r - targetRadius) > 0.01 || po.orbitLine.userData?.r === undefined) {
        const segments = 256;
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * Math.PI * 2;
          positions.setXYZ(i, Math.cos(a) * targetRadius, 0, Math.sin(a) * targetRadius);
        }
        positions.needsUpdate = true;
        po.orbitLine.userData = { r: targetRadius };
      }
      po.orbitLine.visible = showOrbits;

      // 衛星
      po.moons.forEach(mo => {
        const m = mo.data;
        const mDist = scaleMode === 'edu' ? m.distance : Math.max(m.distance, m.distanceReal * 0.3);
        const mAngle = (totalDays / m.period) * Math.PI * 2;
        mo.group.position.set(Math.cos(mAngle) * mDist, 0, Math.sin(mAngle) * mDist);
        mo.mesh.rotation.y += dt * 0.5 * speed * 0.1;
        // 衛星軌道更新
        const mPositions = mo.orbitLine.geometry.attributes.position;
        if (Math.abs(mo.orbitLine.userData?.r - mDist) > 0.01 || mo.orbitLine.userData?.r === undefined) {
          const seg = 64;
          for (let i = 0; i <= seg; i++) {
            const a = (i / seg) * Math.PI * 2;
            mPositions.setXYZ(i, Math.cos(a) * mDist, 0, Math.sin(a) * mDist);
          }
          mPositions.needsUpdate = true;
          mo.orbitLine.userData = { r: mDist };
        }
        mo.orbitLine.visible = showOrbits;
      });
    });

    // 更新 UI 標籤位置
    if (window.updateLabels) {
      window.updateLabels(camera, renderer, [
        { mesh: sun, name: SOLAR_DATA.sun.name, type: 'sun' },
        ...planetObjs.map(po => ({ mesh: po.mesh, group: po.group, name: po.data.name, type: 'planet' })),
      ]);
    }

    controls.update();
    renderer.render(scene, camera);
  };

  return {
    init,
    setSpeed: (v) => { speed = v; },
    setPlaying: (v) => { playing = v; },
    isPlaying: () => playing,
    reset: () => {
      simulationDate = new Date('2026-01-01T00:00:00Z');
      camera.position.set(0, 60, 140);
      controls.target.set(0, 0, 0);
    },
    setScaleMode: (m) => { scaleMode = m; },
    setShowOrbits: (v) => { showOrbits = v; },
    setShowLabels: (v) => { showLabels = v; window.dispatchEvent(new CustomEvent('labelsToggle', {detail: v})); },
    getShowLabels: () => showLabels,
    getDate: () => simulationDate,
    onPlanetClick: (cb) => { onPlanetClick = cb; },
    setControlMode: (mode) => {
      // mode: 'rotate' or 'pan'
      if (!controls) return;
      if (mode === 'pan') {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        };
      } else {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
      }
    },
    setPaused: (v) => {
      if (renderer) renderer.domElement.style.display = v ? 'none' : 'block';
    },
    focusOn: (key) => {
      let target;
      if (key === 'sun') target = sun.position;
      else {
        const po = planetObjs.find(p => p.data.key === key);
        if (po) target = po.group.position;
      }
      if (target) {
        controls.target.copy(target);
        const offset = new THREE.Vector3().subVectors(camera.position, controls.target0 || new THREE.Vector3()).normalize().multiplyScalar(20);
        camera.position.copy(target).add(offset);
      }
    },
    getPlanets: () => planetObjs,
  };
})();
