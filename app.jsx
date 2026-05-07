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
  earth: [
    { x: 0, z: 0, name: '中央谷地' },
    { x: 120, z: 60, name: '東部丘陵' },
    { x: -120, z: 80, name: '西部森林' },
    { x: 80, z: -150, name: '北方高原' },
    { x: -100, z: -100, name: '西北山麓' },
    { x: 150, z: -50, name: '東岸海角' },
    { x: -50, z: 180, name: '南方湖區' },
    { x: 60, z: 200, name: '南端草原' },
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
};

function getRegionName(planetKey, x, z) {
  const labels = REGION_LABELS[planetKey] || [];
  let best = labels[0];
  let bestD = Infinity;
  labels.forEach(l => {
    const d = (l.x - x) ** 2 + (l.z - z) ** 2;
    if (d < bestD) { bestD = d; best = l; }
  });
  return best ? best.name : '未知區域';
}

function compassDir(yaw) {
  // yaw 0 = -Z (北)；增加 yaw 為向左轉
  // 標準：N, NE, E, SE, S, SW, W, NW
  const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const headingsZh = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
  // 玩家面朝 = (-sin(yaw), 0, -cos(yaw))，化成羅盤角度（北=0，順時針）
  let deg = (Math.atan2(-Math.sin(yaw), -Math.cos(yaw)) * 180 / Math.PI + 360) % 360;
  // 轉羅盤：北=0 對應 -Z，所以 0deg 已經是北
  const i = Math.round(deg / 45) % 8;
  return { en: headings[i], zh: headingsZh[i], deg: Math.round(deg) };
}

function WalkHUD({ planetKey }) {
  const [hud, setHud] = useState({ x: 0, z: 0, elevation: 0, altitude: 0, yaw: 0, flyMode: false, flySpeed: 30 });
  useEffect(() => {
    window.updateWalkHUD = (d) => setHud(d);
    return () => { window.updateWalkHUD = null; };
  }, []);

  const lat = (-hud.z / 100).toFixed(4);
  const lon = (hud.x / 100).toFixed(4);
  const elev = hud.elevation.toFixed(1);
  const alt = (hud.altitude || 0).toFixed(0);
  const region = getRegionName(planetKey, hud.x, hud.z);
  const compass = compassDir(hud.yaw);

  // 玩家永遠在地圖正中央，地標相對玩家位置
  const mapSize = 200;
  const range = 400; // 視野範圍 ±400 單位
  const cx = mapSize / 2;
  const cz = mapSize / 2;
  const arrowAngle = -hud.yaw * 180 / Math.PI;

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
          const dx = l.x - hud.x;
          const dz = l.z - hud.z;
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
          <span>滑鼠拖曳：環顧四周</span>
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
