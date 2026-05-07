// 程序化生成行星紋理（避免外部依賴，符合寫實 NASA 風）
window.makeTexture = function(type, baseColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const hexToRgb = (hex) => {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return [r, g, b];
  };

  const [br, bg, bb] = hexToRgb(baseColor);

  // 基底色
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const noise = (x, y, scale = 0.01) => {
    return (Math.sin(x * scale * 12.9898 + y * scale * 78.233) * 43758.5453) % 1;
  };

  if (type === 'rocky_gray') {
    // 水星：撞擊坑
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const v = (Math.random() - 0.5) * 60;
      ctx.fillStyle = `rgb(${Math.max(0,Math.min(255,br+v))},${Math.max(0,Math.min(255,bg+v))},${Math.max(0,Math.min(255,bb+v))})`;
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = Math.random() * 12 + 3;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${br-30},${bg-30},${bb-30},0.7)`);
      grad.addColorStop(0.7, `rgba(${br+20},${bg+20},${bb+20},0.4)`);
      grad.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'venus') {
    // 金星：黃褐色雲層條紋
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const swirl = Math.sin(y * 0.05 + Math.sin(x * 0.02) * 3) * 30;
        const v = swirl + (Math.random() - 0.5) * 20;
        ctx.fillStyle = `rgb(${Math.max(0,Math.min(255,br+v))},${Math.max(0,Math.min(255,bg+v*0.8))},${Math.max(0,Math.min(255,bb+v*0.5))})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  } else if (type === 'earth') {
    // 地球：藍色海洋 + 綠色大陸
    ctx.fillStyle = '#1a4a8c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 大陸（隨機塊狀）
    const continents = [
      {x: 200, y: 150, w: 180, h: 160}, // 北美
      {x: 280, y: 320, w: 90, h: 140},  // 南美
      {x: 480, y: 130, w: 80, h: 120},  // 歐
      {x: 500, y: 250, w: 120, h: 180}, // 非
      {x: 600, y: 130, w: 220, h: 180}, // 亞
      {x: 760, y: 360, w: 100, h: 60},  // 澳
      {x: 100, y: 50, w: 850, h: 30},   // 北極冰
      {x: 100, y: 460, w: 850, h: 50},  // 南極冰
    ];
    continents.forEach((c, i) => {
      const isIce = i >= 6;
      ctx.fillStyle = isIce ? '#ddeeff' : '#3a6e3a';
      for (let j = 0; j < 40; j++) {
        const cx = c.x + Math.random() * c.w;
        const cy = c.y + Math.random() * c.h;
        const r = Math.random() * 25 + 10;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    // 雲層
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = Math.random() * 30 + 10;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (type === 'mars') {
    // 火星：紅色 + 極冠
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const v = (Math.random() - 0.5) * 40;
        const dy = Math.abs(y - canvas.height / 2);
        const polar = dy > canvas.height * 0.42 ? 80 : 0;
        ctx.fillStyle = `rgb(${Math.max(0,Math.min(255,br+v+polar))},${Math.max(0,Math.min(255,bg+v*0.5+polar))},${Math.max(0,Math.min(255,bb+v*0.3+polar))})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // 暗區
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * canvas.width;
      const y = canvas.height * 0.3 + Math.random() * canvas.height * 0.4;
      const r = Math.random() * 40 + 20;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(80,30,15,0.5)');
      grad.addColorStop(1, 'rgba(80,30,15,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'jupiter' || type === 'saturn') {
    // 氣態行星：水平條紋
    const isJup = type === 'jupiter';
    const bands = isJup ? 14 : 10;
    for (let y = 0; y < canvas.height; y++) {
      const t = y / canvas.height;
      const band = Math.floor(t * bands);
      const inBand = (t * bands) - band;
      const wave = Math.sin(band * 1.7) * 0.5 + 0.5;
      const r = br + wave * 40 - 20 + (Math.random() - 0.5) * 15;
      const g = bg + wave * 35 - 15 + (Math.random() - 0.5) * 12;
      const b = bb + wave * 25 - 10 + (Math.random() - 0.5) * 10;
      for (let x = 0; x < canvas.width; x++) {
        const swirl = Math.sin(x * 0.03 + band * 2) * 12;
        ctx.fillStyle = `rgb(${Math.max(0,Math.min(255,r+swirl))},${Math.max(0,Math.min(255,g+swirl))},${Math.max(0,Math.min(255,b+swirl*0.5))})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // 木星大紅斑
    if (isJup) {
      const grx = canvas.width * 0.3;
      const gry = canvas.height * 0.62;
      const grad = ctx.createRadialGradient(grx, gry, 0, grx, gry, 50);
      grad.addColorStop(0, 'rgba(180,60,40,0.95)');
      grad.addColorStop(0.6, 'rgba(160,80,50,0.7)');
      grad.addColorStop(1, 'rgba(160,80,50,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(grx, gry, 60, 35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'uranus' || type === 'neptune') {
    // 冰巨行星：均勻藍 + 細微雲帶
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const wave = Math.sin(y * 0.03) * 8;
        const v = (Math.random() - 0.5) * 12 + wave;
        ctx.fillStyle = `rgb(${Math.max(0,Math.min(255,br+v))},${Math.max(0,Math.min(255,bg+v))},${Math.max(0,Math.min(255,bb+v))})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    if (type === 'neptune') {
      // 大暗斑
      const grad = ctx.createRadialGradient(canvas.width*0.4, canvas.height*0.4, 0, canvas.width*0.4, canvas.height*0.4, 40);
      grad.addColorStop(0, 'rgba(20,30,80,0.7)');
      grad.addColorStop(1, 'rgba(20,30,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(canvas.width*0.4, canvas.height*0.4, 50, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'sun') {
    // 太陽：黃橘色 + 米粒組織
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const v = (Math.random() - 0.5) * 50;
        const cell = Math.sin(x * 0.08) * Math.cos(y * 0.08) * 30;
        ctx.fillStyle = `rgb(${Math.max(0,Math.min(255,255+v))},${Math.max(0,Math.min(255,180+v+cell))},${Math.max(0,Math.min(255,40+v*0.5))})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // 黑子
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * canvas.width;
      const y = canvas.height * 0.3 + Math.random() * canvas.height * 0.4;
      const r = Math.random() * 8 + 4;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(80,30,0,0.9)');
      grad.addColorStop(1, 'rgba(80,30,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'moon') {
    // 月球紋理
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const v = (Math.random() - 0.5) * 50;
      const c = 170 + v;
      ctx.fillStyle = `rgb(${c},${c},${c})`;
      ctx.fillRect(x, y, 2, 2);
    }
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = Math.random() * 15 + 4;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(80,80,80,0.6)');
      grad.addColorStop(1, 'rgba(80,80,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

// 環紋理
window.makeRingTexture = function(innerColor, outerColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < canvas.width; x++) {
    const t = x / canvas.width;
    const noise = Math.random() * 0.3 + 0.7;
    const gap1 = Math.abs(t - 0.55) < 0.02 ? 0.2 : 1;
    const gap2 = Math.abs(t - 0.78) < 0.015 ? 0.3 : 1;
    const alpha = noise * gap1 * gap2 * (1 - Math.abs(t - 0.5) * 0.4);
    ctx.fillStyle = `rgba(220, 200, 160, ${alpha})`;
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};
