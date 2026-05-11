const { useState, useEffect, useRef, useCallback } = React;

// ===== 工具函式 =====
const formatDate = (d) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y} 年 ${m} 月 ${day} 日`;
};

const formatSpeed = (s) => {
  if (s < 1) return `${s.toFixed(2)} 天/秒`;
  if (s < 100) return `${s.toFixed(1)} 天/秒`;
  if (s < 1000) return `${Math.round(s)} 天/秒`;
  return `${(s/365).toFixed(1)} 年/秒`;
};

// ===== 速度滑桿（對數）=====
function SpeedSlider({ value, onChange }) {
  // 1 ~ 10000 天/秒，對數
  const min = Math.log10(1);
  const max = Math.log10(10000);
  const t = (Math.log10(Math.max(1, value)) - min) / (max - min);
  return (
    <div className="speed-slider">
      <div className="slider-label">
        <span className="slider-title">模擬速度</span>
        <span className="slider-value">{formatSpeed(value)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.001"
        value={t}
        onChange={(e) => {
          const tt = parseFloat(e.target.value);
          const v = Math.pow(10, min + tt * (max - min));
          onChange(v);
        }}
      />
      <div className="slider-ticks">
        <span>1 天/秒</span>
        <span>30</span>
        <span>1 年</span>
        <span>30 年/秒</span>
      </div>
    </div>
  );
}

// ===== 行星資訊卡 =====
function InfoCard({ data, onClose, onEnter }) {
  if (!data) return null;
  const isMoon = data.type === 'moon';
  const isSun = data.type === 'sun';
  const d = data.data;
  const info = d.info || {};
  const canWalk = !isMoon && !isSun && PlanetWalk && PlanetWalk.isAvailable && PlanetWalk.isAvailable(d.key);

  return (
    <div className="info-card">
      <button className="close-btn" onClick={onClose}>×</button>
      <div className="info-header">
        <div className="info-name-zh">{d.name}</div>
        <div className="info-name-en">{d.nameEn}</div>
      </div>
      {canWalk && (
        <button className="enter-btn" onClick={() => onEnter && onEnter(d.key)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 5l7 7-7 7"/><path d="M4 12h16"/></svg>
          進入 {d.name} 表面漫遊
        </button>
      )}

      {isMoon ? (
        <div className="info-body">
          <div className="info-desc">
            {d.name} 是 {data.parent.name} 的衛星之一。
          </div>
          <div className="info-grid">
            <div className="info-row"><span>所屬行星</span><b>{data.parent.name}</b></div>
            <div className="info-row"><span>公轉週期</span><b>{Math.abs(d.period).toFixed(2)} 天{d.period<0?'（逆向）':''}</b></div>
          </div>
        </div>
      ) : (
        <div className="info-body">
          <div className="info-desc">{info.desc}</div>
          <div className="info-grid">
            {info.type && <div className="info-row"><span>類型</span><b>{info.type}</b></div>}
            {info.diameter && <div className="info-row"><span>直徑</span><b>{info.diameter}</b></div>}
            {info.mass && <div className="info-row"><span>質量</span><b>{info.mass}</b></div>}
            {info.distance && <div className="info-row"><span>距太陽</span><b>{info.distance}</b></div>}
            {info.period && <div className="info-row"><span>公轉週期</span><b>{info.period}</b></div>}
            {info.day && <div className="info-row"><span>自轉週期</span><b>{info.day}</b></div>}
            {info.temp && <div className="info-row"><span>表面溫度</span><b>{info.temp}</b></div>}
            {info.surfaceTemp && <div className="info-row"><span>表面溫度</span><b>{info.surfaceTemp}</b></div>}
            {info.coreTemp && <div className="info-row"><span>核心溫度</span><b>{info.coreTemp}</b></div>}
            {info.age && <div className="info-row"><span>年齡</span><b>{info.age}</b></div>}
            {info.moons && <div className="info-row"><span>衛星</span><b>{info.moons}</b></div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 行星選單 =====
function PlanetMenu({ onFocus }) {
  const items = [
    { key: 'sun', name: '太陽', color: '#ffcc55' },
    { key: 'mercury', name: '水星', color: '#9c8b7e' },
    { key: 'venus', name: '金星', color: '#e8c07a' },
    { key: 'earth', name: '地球', color: '#4a7fc1' },
    { key: 'mars', name: '火星', color: '#c1502e' },
    { key: 'jupiter', name: '木星', color: '#d4a373' },
    { key: 'saturn', name: '土星', color: '#e6c98a' },
    { key: 'uranus', name: '天王星', color: '#9ad3de' },
    { key: 'neptune', name: '海王星', color: '#3a6fd9' },
  ];
  return (
    <div className="planet-menu">
      <div className="menu-title">快速聚焦</div>
      <div className="menu-list">
        {items.map(it => (
          <button key={it.key} className="planet-btn" onClick={() => onFocus(it.key)}>
            <span className="planet-dot" style={{ background: it.color }}></span>
            <span>{it.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== 標籤管理 =====
function Labels({ visible }) {
  const ref = useRef(null);
  useEffect(() => {
    window.updateLabels = (camera, renderer, items) => {
      const el = ref.current;
      if (!el) return;
      if (!visible) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      // 確保子節點數量
      while (el.children.length < items.length) {
        const d = document.createElement('div');
        d.className = 'planet-label';
        el.appendChild(d);
      }
      while (el.children.length > items.length) el.removeChild(el.lastChild);

      const w = renderer.domElement.clientWidth;
      const h = renderer.domElement.clientHeight;
      items.forEach((it, i) => {
        const node = el.children[i];
        const pos = it.group ? it.group.position.clone() : it.mesh.getWorldPosition(new THREE.Vector3());
        if (it.group) it.mesh.getWorldPosition(pos);
        pos.project(camera);
        const x = (pos.x * 0.5 + 0.5) * w;
        const y = (-pos.y * 0.5 + 0.5) * h;
        const inFront = pos.z < 1;
        node.style.display = inFront ? 'block' : 'none';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.textContent = it.name;
        node.dataset.type = it.type;
      });
    };
    return () => { window.updateLabels = null; };
  }, [visible]);
  return <div className="labels-layer" ref={ref}></div>;
}

// ===== 走動模式 UI =====
const REGION_LABELS = {
  mercury: [
    { x: 0, z: 0, name: '卡洛里斯盆地' },
    { x: 120, z: 60, name: '奧丁平原' },
    { x: -120, z: 80, name: '普希金隕石坑' },
    { x: 80, z: -150, name: '北極盆地' },
    { x: -100, z: -100, name: '貝多芬隕石坑' },
    { x: 150, z: -50, name: '赫爾墨斯平原' },
    { x: -50, z: 180, name: '發現峭壁' },
    { x: 60, z: 200, name: '海明威隕石坑' },
  ],
  venus: [
    { x: 0, z: 0, name: '愛芙蘿黛緹平原' },
    { x: 150, z: 80, name: '麥斯維爾山脈' },
    { x: -130, z: 90, name: '伊師塔高地' },
    { x: 80, z: -160, name: '迪安娜峽谷' },
    { x: -110, z: -90, name: '海倫平原' },
    { x: 180, z: -50, name: '火山帶' },
    { x: -50, z: 180, name: '拉克西米高原' },
    { x: 70, z: 210, name: '玄武岩原野' },
  ],
  earth: [
    { lat: 32.8067, lon: -86.7911, name: '阿拉巴馬州' },
    { lat: 61.3707, lon: -152.4044, name: '阿拉斯加州' },
    { lat: 33.7298, lon: -111.4312, name: '亞利桑那州' },
    { lat: 34.9697, lon: -92.3731, name: '阿肯色州' },
    { lat: 36.1162, lon: -119.6816, name: '加州' },
    { lat: 39.0598, lon: -105.3111, name: '科羅拉多州' },
    { lat: 41.5978, lon: -72.7554, name: '康乃狄克州' },
    { lat: 39.3185, lon: -75.5071, name: '德拉瓦州' },
    { lat: 27.7663, lon: -81.6868, name: '佛羅里達州' },
    { lat: 33.0406, lon: -83.6431, name: '喬治亞州' },
    { lat: 21.0943, lon: -157.4983, name: '夏威夷州' },
    { lat: 44.2405, lon: -114.4788, name: '愛達荷州' },
    { lat: 40.3495, lon: -88.9861, name: '伊利諾州' },
    { lat: 39.8494, lon: -86.2583, name: '印第安納州' },
    { lat: 42.0115, lon: -93.2105, name: '愛荷華州' },
    { lat: 38.5266, lon: -96.7265, name: '堪薩斯州' },
    { lat: 37.6681, lon: -84.6701, name: '肯塔基州' },
    { lat: 31.1695, lon: -91.8678, name: '路易斯安那州' },
    { lat: 44.6939, lon: -69.3819, name: '緬因州' },
    { lat: 39.0639, lon: -76.8021, name: '馬里蘭州' },
    { lat: 42.2302, lon: -71.5301, name: '麻薩諸塞州' },
    { lat: 43.3266, lon: -84.5361, name: '密西根州' },
    { lat: 45.6945, lon: -93.9002, name: '明尼蘇達州' },
    { lat: 32.7416, lon: -89.6787, name: '密西西比州' },
    { lat: 38.4561, lon: -92.2884, name: '密蘇里州' },
    { lat: 46.9219, lon: -110.4544, name: '蒙大拿州' },
    { lat: 41.1254, lon: -98.2681, name: '內布拉斯加州' },
    { lat: 38.3135, lon: -117.0554, name: '內華達州' },
    { lat: 43.4525, lon: -71.5639, name: '新罕布夏州' },
    { lat: 40.2989, lon: -74.5210, name: '紐澤西州' },
    { lat: 34.8405, lon: -106.2485, name: '新墨西哥州' },
    { lat: 42.1657, lon: -74.9481, name: '紐約州' },
    { lat: 35.6301, lon: -79.8064, name: '北卡羅來納州' },
    { lat: 47.5289, lon: -99.7840, name: '北達科他州' },
    { lat: 40.3888, lon: -82.7649, name: '俄亥俄州' },
    { lat: 35.5653, lon: -96.9289, name: '奧克拉荷馬州' },
    { lat: 44.5720, lon: -122.0709, name: '奧勒岡州' },
    { lat: 40.5908, lon: -77.2098, name: '賓夕法尼亞州' },
    { lat: 41.6809, lon: -71.5118, name: '羅德島州' },
    { lat: 33.8569, lon: -80.9450, name: '南卡羅來納州' },
    { lat: 44.2998, lon: -99.4388, name: '南達科他州' },
    { lat: 35.7478, lon: -86.6923, name: '田納西州' },
    { lat: 31.0545, lon: -97.5635, name: '德州' },
    { lat: 40.1500, lon: -111.8624, name: '猶他州' },
    { lat: 44.0459, lon: -72.7107, name: '佛蒙特州' },
    { lat: 37.7693, lon: -78.1700, name: '維吉尼亞州' },
    { lat: 47.4009, lon: -121.4905, name: '華盛頓州' },
    { lat: 38.4912, lon: -80.9545, name: '西維吉尼亞州' },
    { lat: 44.2685, lon: -89.6165, name: '威斯康辛州' },
    { lat: 42.7560, lon: -107.3025, name: '懷俄明州' },
    { lat: 38.9072, lon: -77.0369, name: '華盛頓特區' },
    { lat: 25.7617, lon: -80.1918, name: '邁阿密' },
    { lat: 34.0522, lon: -118.2437, name: '洛杉磯' },
    { lat: 37.7749, lon: -122.4194, name: '舊金山' },
    { lat: 40.7128, lon: -74.0060, name: '紐約市' },
    { lat: 41.8781, lon: -87.6298, name: '芝加哥' },
    { lat: 29.7604, lon: -95.3698, name: '休士頓' },
    { lat: 47.6062, lon: -122.3321, name: '西雅圖' },
    { lat: 51.5074, lon: -0.1278, name: '倫敦' },
    { lat: 48.8566, lon: 2.3522, name: '巴黎' },
    { lat: 35.6762, lon: 139.6503, name: '東京' },
    { lat: 25.0330, lon: 121.5654, name: '台北' },
    { lat: 22.3193, lon: 114.1694, name: '香港' },
    { lat: 31.2304, lon: 121.4737, name: '上海' },
    { lat: 39.9042, lon: 116.4074, name: '北京' },
    { lat: 37.5665, lon: 126.9780, name: '首爾' },
    { lat: 13.7563, lon: 100.5018, name: '曼谷' },
    { lat: 16.8409, lon: 96.1735, name: '仰光' },
    { lat: 1.3521, lon: 103.8198, name: '新加坡' },
    { lat: 8.7000, lon: 96.1000, name: '安達曼海' },
    { lat: 7.9319, lon: 93.5377, name: '尼科巴群島' },
    { lat: 19.0760, lon: 72.8777, name: '孟買' },
    { lat: 28.6139, lon: 77.2090, name: '新德里' },
    { lat: 25.2048, lon: 55.2708, name: '杜拜' },
    { lat: 41.0082, lon: 28.9784, name: '伊斯坦堡' },
    { lat: -33.8688, lon: 151.2093, name: '雪梨' },
    { lat: -37.8136, lon: 144.9631, name: '墨爾本' },
    { lat: -22.9068, lon: -43.1729, name: '里約熱內盧' },
    { lat: -20.5000, lon: -30.0000, name: '南大西洋' },
    { lat: 30.0000, lon: -45.0000, name: '北大西洋' },
    { lat: 0.0000, lon: -140.0000, name: '太平洋' },
    { lat: -20.0000, lon: 80.0000, name: '印度洋' },
    { lat: 80.0000, lon: 0.0000, name: '北冰洋' },
    { lat: -60.0000, lon: 80.0000, name: '南冰洋' },
    { lat: -34.6037, lon: -58.3816, name: '布宜諾斯艾利斯' },
    { lat: -33.4489, lon: -70.6693, name: '聖地牙哥' },
    { lat: 30.0444, lon: 31.2357, name: '開羅' },
    { lat: -1.2921, lon: 36.8219, name: '奈洛比' },
    { lat: -33.9249, lon: 18.4241, name: '開普敦' },
    { lat: 27.9881, lon: 86.9250, name: '聖母峰' },
    { lat: -3.4653, lon: -62.2159, name: '亞馬遜雨林' },
    { lat: 23.4162, lon: 25.6628, name: '撒哈拉沙漠' },
    { lat: 36.5785, lon: -118.2923, name: '內華達山脈' },
    { lat: 44.4280, lon: -110.5885, name: '黃石國家公園' },
    { lat: 36.1069, lon: -112.1129, name: '大峽谷' },
    { lat: -13.1631, lon: -72.5450, name: '馬丘比丘' },
    { lat: -18.2871, lon: 147.6992, name: '大堡礁' },
    { lat: 64.9631, lon: -19.0208, name: '冰島' },
    { lat: 71.7069, lon: -42.6043, name: '格陵蘭冰原' },
  ],
  mars: [
    { x: 0, z: 0, name: '艾瑞斯平原' },
    { x: 120, z: 60, name: '東岩台地' },
    { x: -120, z: 80, name: '塞東尼亞盆地' },
    { x: 80, z: -150, name: '北極殘冰' },
    { x: -100, z: -100, name: '奧林帕斯山麓' },
    { x: 150, z: -50, name: '水手號峽谷' },
    { x: -50, z: 180, name: '南赤道沙海' },
    { x: 60, z: 200, name: '希臘平原' },
  ],
  uranus: [
    { x: 0, z: 0, name: '冰晶平原' },
    { x: 150, z: 80, name: '氮冰高地' },
    { x: -130, z: 90, name: '甲烷霜區' },
    { x: 80, z: -160, name: '冰山群' },
    { x: -110, z: -90, name: '藍綠低谷' },
    { x: 180, z: -50, name: '環帶投影區' },
    { x: -50, z: 180, name: '南冰原' },
    { x: 70, z: 210, name: '天王星深淵' },
  ],
  neptune: [
    { x: 0, z: 0, name: '大黑斑外圍' },
    { x: 150, z: 80, name: '氮冰原野' },
    { x: -130, z: 90, name: '風暴走廊' },
    { x: 80, z: -160, name: '氫冰山脈' },
    { x: -110, z: -90, name: '崔頓觀測點' },
    { x: 180, z: -50, name: '超音速氣流區' },
    { x: -50, z: 180, name: '深藍平原' },
    { x: 70, z: 210, name: '冰火山域' },
  ],
};

function geoDelta(lonA, lonB) {
  let d = lonA - lonB;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

function geoDistanceSq(aLat, aLon, bLat, bLon) {
  const meanLat = ((aLat + bLat) / 2) * Math.PI / 180;
  const dx = geoDelta(aLon, bLon) * Math.cos(meanLat);
  const dy = aLat - bLat;
  return dx * dx + dy * dy;
}

function getRegionName(planetKey, x, z, lat = null, lon = null) {
  const labels = REGION_LABELS[planetKey] || [];
  let best = labels[0];
  let bestD = Infinity;
  labels.forEach(l => {
    const d = lat !== null && lon !== null && typeof l.lat === 'number' && typeof l.lon === 'number'
      ? geoDistanceSq(lat, lon, l.lat, l.lon)
      : (l.x - x) ** 2 + (l.z - z) ** 2;
    if (d < bestD) { bestD = d; best = l; }
  });
  return best ? best.name : '未知區域';
}

function compassDir(yaw, sphereMode = false) {
  const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const headingsZh = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
  const deg = sphereMode
    ? (yaw * 180 / Math.PI + 360) % 360
    : (Math.atan2(-Math.sin(yaw), -Math.cos(yaw)) * 180 / Math.PI + 360) % 360;
  const i = Math.round(deg / 45) % 8;
  return { en: headings[i], zh: headingsZh[i], deg: Math.round(deg) };
}

function WalkHUD({ planetKey }) {
  const [hud, setHud] = useState({ x: 0, z: 0, elevation: 0, altitude: 0, yaw: 0, flyMode: false, flySpeed: 30 });
  useEffect(() => {
    window.updateWalkHUD = (d) => setHud(d);
    return () => { window.updateWalkHUD = null; };
  }, []);

  const latValue = hud.sphereMode && typeof hud.lat === 'number' ? hud.lat : -hud.z / 100;
  const lonValue = hud.sphereMode && typeof hud.lon === 'number' ? hud.lon : hud.x / 100;
  const lat = latValue.toFixed(4);
  const lon = lonValue.toFixed(4);
  const elev = hud.elevation.toFixed(1);
  const alt = (hud.altitude || 0).toFixed(0);
  const region = getRegionName(planetKey, hud.x, hud.z, hud.sphereMode ? latValue : null, hud.sphereMode ? lonValue : null);
  const compass = compassDir(hud.yaw, hud.sphereMode);

  // 玩家永遠在地圖正中央，地標相對玩家位置
  const mapSize = 200;
  const range = hud.sphereMode ? 18 : 400; // 球面模式顯示附近 18 度，其他星球維持原本單位
  const cx = mapSize / 2;
  const cz = mapSize / 2;
  const arrowAngle = hud.sphereMode ? hud.yaw * 180 / Math.PI : -hud.yaw * 180 / Math.PI;

  return (
    <div className="gps-panel">
      <div className="gps-header">
        <span className="gps-dot" style={{ background: hud.flyMode ? '#ffaa55' : '#4ade80', boxShadow: `0 0 8px ${hud.flyMode ? '#ffaa55' : '#4ade80'}` }}></span>
        <span>{hud.flyMode ? '飛行中' : 'GPS 定位'}</span>
      </div>
      <div className="gps-region">{region}</div>
      <div className="gps-rows">
        <div className="gps-row"><span>緯度</span><b>{lat >= 0 ? `${lat}° N` : `${Math.abs(lat).toFixed(4)}° S`}</b></div>
        <div className="gps-row"><span>經度</span><b>{lon >= 0 ? `${lon}° E` : `${Math.abs(lon).toFixed(4)}° W`}</b></div>
        <div className="gps-row"><span>海拔</span><b>{elev} m</b></div>
        <div className="gps-row"><span>飛行高度</span><b>{alt} m</b></div>
        <div className="gps-row"><span>朝向</span><b>{compass.zh} ({compass.deg}°)</b></div>
      </div>
      <div className="mini-map" style={{ width: mapSize, height: mapSize }}>
        <div className="map-grid"></div>
        <div className="map-cross-h"></div>
        <div className="map-cross-v"></div>
        {(REGION_LABELS[planetKey] || []).map((l, i) => {
          const isGeo = hud.sphereMode && typeof l.lat === 'number' && typeof l.lon === 'number';
          const dx = isGeo ? geoDelta(l.lon, lonValue) * Math.cos(latValue * Math.PI / 180) : l.x - hud.x;
          const dz = isGeo ? latValue - l.lat : l.z - hud.z;
          const lx = cx + (dx / range) * (mapSize / 2);
          const lz = cz + (dz / range) * (mapSize / 2);
          if (lx < 6 || lx > mapSize - 6 || lz < 6 || lz > mapSize - 6) return null;
          return (
            <div key={i} className="map-poi-wrap" style={{ left: lx, top: lz }}>
              <div className="map-poi"></div>
              <div className="map-poi-label">{l.name}</div>
            </div>
          );
        })}
        <div className="map-player" style={{ left: cx, top: cz, transform: `translate(-50%,-50%) rotate(${arrowAngle}deg)` }}>
          <svg width="18" height="18" viewBox="0 0 16 16">
            <path d="M8 1 L13 14 L8 11 L3 14 Z" fill={hud.flyMode ? '#ffaa55' : '#6ec1ff'} stroke="#001020" strokeWidth="0.8"/>
          </svg>
        </div>
        <div className="map-N">N</div>
      </div>
    </div>
  );
}

function WalkMode({ planetKey, onExit }) {
  const containerRef = useRef(null);
  const [flyMode, setFlyMode] = useState(false);
  const [flySpeed, setFlySpeed] = useState(30);

  useEffect(() => {
    if (!containerRef.current) return;
    PlanetWalk.init(containerRef.current, planetKey);
    PlanetWalk.onModeChange((on) => setFlyMode(on));
    return () => PlanetWalk.dispose();
  }, [planetKey]);

  useEffect(() => { PlanetWalk.setFlySpeed && PlanetWalk.setFlySpeed(flySpeed); }, [flySpeed]);

  const toggleFly = () => {
    const v = !flyMode;
    PlanetWalk.setFlyMode(v);
    setFlyMode(v);
  };

  const planetName = PlanetWalk.getName(planetKey);
  return (
    <>
      <div ref={containerRef} className="canvas-container"></div>
      <div className="walk-hud-top">
        <div className="walk-title">
          <span className="walk-tag">{flyMode ? '太空船模式' : '表面漫遊'}</span>
          <span className="walk-planet">{planetName}</span>
        </div>
        <button className="walk-exit" onClick={onExit}>← 返回太空</button>
      </div>
      <WalkHUD planetKey={planetKey} />

      <div className="fly-panel">
        <button className={`fly-toggle ${flyMode ? 'active' : ''}`} onClick={toggleFly}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 L4 20 L12 16 L20 20 Z"/></svg>
          {flyMode ? '降落（步行）' : '起飛（太空船）'} <kbd>F</kbd>
        </button>
        {flyMode && (
          <div className="fly-speed">
            <div className="fly-speed-label">
              <span>飛行速度</span>
              <b>{flySpeed} m/s</b>
            </div>
            <input
              type="range"
              min="5"
              max="500"
              step="1"
              value={flySpeed}
              onChange={(e) => setFlySpeed(parseInt(e.target.value))}
            />
            <div className="fly-speed-ticks">
              <span>慢</span>
              <span>中</span>
              <span>快</span>
              <span>極速</span>
            </div>
          </div>
        )}
      </div>

      <div className="walk-hud-bottom">
        <div className="walk-keys">
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移動</span>
          {flyMode ? (
            <>
              <span><kbd>Space</kbd> 上升</span>
              <span><kbd>Shift</kbd> 下降</span>
            </>
          ) : (
            <span><kbd>Space</kbd> 跳躍</span>
          )}
          <span><kbd>F</kbd> 切換飛行</span>
          <span>拖曳畫面：環顧四周</span>
        </div>
        <div className="walk-crosshair">+</div>
      </div>
    </>
  );
}

// ===== 主 App =====
function App() {
  const containerRef = useRef(null);
  const [speed, setSpeed] = useState(10);
  const [playing, setPlaying] = useState(true);
  const [date, setDate] = useState(new Date('2026-01-01T00:00:00Z'));
  const [selected, setSelected] = useState(null);
  const [scaleMode, setScaleMode] = useState('edu');
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [controlMode, setControlMode] = useState('rotate'); // 'rotate' or 'pan'
  const [walkPlanet, setWalkPlanet] = useState(null);
  const inited = useRef(false);

  useEffect(() => {
    if (walkPlanet) return; // walk 模式時不初始化太空場景
    if (!containerRef.current) return;
    SolarSystem.init(containerRef.current); // idempotent — 重複呼叫會 reattach
    SolarSystem.onPlanetClick((data) => setSelected(data));
    inited.current = true;
    // 從 walk 返回時重新套用設定
    SolarSystem.setSpeed(speed);
    SolarSystem.setPlaying(playing);
    SolarSystem.setScaleMode(scaleMode);
    SolarSystem.setShowOrbits(showOrbits);
    SolarSystem.setShowLabels(showLabels);
    if (SolarSystem.setControlMode) SolarSystem.setControlMode(controlMode);
    const tick = setInterval(() => setDate(SolarSystem.getDate()), 200);
    return () => clearInterval(tick);
  }, [walkPlanet]);

  useEffect(() => { if (inited.current) SolarSystem.setSpeed(speed); }, [speed]);
  useEffect(() => { if (inited.current) SolarSystem.setPlaying(playing); }, [playing]);
  useEffect(() => { if (inited.current) SolarSystem.setScaleMode(scaleMode); }, [scaleMode]);
  useEffect(() => { if (inited.current) SolarSystem.setShowOrbits(showOrbits); }, [showOrbits]);
  useEffect(() => { if (inited.current) SolarSystem.setShowLabels(showLabels); }, [showLabels]);
  useEffect(() => { if (inited.current && SolarSystem.setControlMode) SolarSystem.setControlMode(controlMode); }, [controlMode]);

  const handleReset = () => {
    SolarSystem.reset();
    setDate(SolarSystem.getDate());
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (walkPlanet) {
    return <WalkMode planetKey={walkPlanet} onExit={() => setWalkPlanet(null)} />;
  }

  return (
    <>
      <div ref={containerRef} className="canvas-container"></div>
      <Labels visible={showLabels} />

      {/* 頂部資訊 */}
      <div className="top-bar">
        <div className="logo">
          <span className="logo-icon">☉</span>
          <span className="logo-text">太陽系運轉模擬</span>
          <span className="logo-sub">Solar System Simulator</span>
        </div>
        <div className="date-display">
          <div className="date-label">模擬日期</div>
          <div className="date-value">{formatDate(date)}</div>
        </div>
      </div>

      {/* 左側：行星選單 */}
      <PlanetMenu onFocus={(k) => SolarSystem.focusOn(k)} />

      {/* 右側：資訊卡 */}
      {selected && (
        <InfoCard
          data={selected}
          onClose={() => setSelected(null)}
          onEnter={(key) => { setSelected(null); setWalkPlanet(key); }}
        />
      )}

      {/* 底部控制 */}
      <div className="bottom-bar">
        <div className="control-group">
          <button className="ctrl-btn primary" onClick={() => setPlaying(!playing)} title={playing ? '暫停' : '播放'}>
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
          <button className="ctrl-btn" onClick={handleReset} title="重置">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        </div>

        <div className="speed-wrap">
          <SpeedSlider value={speed} onChange={setSpeed} />
        </div>

        <div className="control-group">
          <div className="scale-toggle" title="切換滑鼠左鍵行為">
            <button className={controlMode === 'rotate' ? 'active' : ''} onClick={() => setControlMode('rotate')}>旋轉</button>
            <button className={controlMode === 'pan' ? 'active' : ''} onClick={() => setControlMode('pan')}>平移</button>
          </div>
          <button className={`toggle-btn ${showOrbits ? 'active' : ''}`} onClick={() => setShowOrbits(!showOrbits)}>軌道線</button>
          <button className={`toggle-btn ${showLabels ? 'active' : ''}`} onClick={() => setShowLabels(!showLabels)}>標籤</button>
          <div className="scale-toggle">
            <button className={scaleMode === 'edu' ? 'active' : ''} onClick={() => setScaleMode('edu')}>教學</button>
            <button className={scaleMode === 'real' ? 'active' : ''} onClick={() => setScaleMode('real')}>真實</button>
          </div>
          <button className="ctrl-btn" onClick={toggleFullscreen} title="全螢幕">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/></svg>
          </button>
          <button className="ctrl-btn" onClick={() => setShowHelp(!showHelp)} title="說明">?</button>
        </div>
      </div>

      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-card" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowHelp(false)}>×</button>
            <h2>操作說明</h2>
            <div className="help-grid">
              <div><b>左鍵拖曳</b><span>旋轉視角</span></div>
              <div><b>右鍵拖曳</b><span>平移視角</span></div>
              <div><b>滾輪</b><span>縮放</span></div>
              <div><b>點擊行星</b><span>顯示資訊卡</span></div>
              <div><b>快速聚焦</b><span>左側選單可快速跳到行星</span></div>
              <div><b>速度滑桿</b><span>1 秒模擬 1~10000 天</span></div>
              <div><b>教學/真實</b><span>切換距離比例</span></div>
              <div><b>軌道線/標籤</b><span>顯示開關</span></div>
            </div>
            <p className="help-note">本模擬包含 8 大行星與 17 顆主要衛星，以 J2000 為時間基準。教學模式壓縮了行星間距離，真實模式則使用對數縮放，方便觀察外行星。</p>
          </div>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
