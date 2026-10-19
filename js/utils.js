import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 *  Small deterministic helpers
 * ------------------------------------------------------------------ */

export function createRng(seed = 20240517) {
  let state = seed >>> 0;
  return function rng() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (rng, min, max) => min + (max - min) * rng();
export const pick = (rng, list) => list[Math.floor(rng() * list.length)];
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const smoothstep = (min, max, value) => {
  const x = clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
};
export const damp = (current, target, lambda, dt) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));
export const dampColor = (current, target, lambda, dt) =>
  current.lerp(target, 1 - Math.exp(-lambda * dt));

/* ------------------------------------------------------------------ *
 *  Geometry / material helpers
 * ------------------------------------------------------------------ */

/**
 * Merge a small number of BufferGeometries without pulling in the
 * examples/jsm addon. Only the attributes we actually use are copied.
 */
export function mergeGeometries(geometries) {
  const sources = geometries.map((geometry) =>
    geometry.index ? geometry.toNonIndexed() : geometry
  );
  const names = ['position', 'normal', 'uv', 'color'].filter((name) =>
    sources.every((geometry) => geometry.getAttribute(name))
  );

  const merged = new THREE.BufferGeometry();
  let total = 0;
  for (const geometry of sources) total += geometry.getAttribute('position').count;

  for (const name of names) {
    const template = sources[0].getAttribute(name);
    const array = new Float32Array(total * template.itemSize);
    let offset = 0;
    for (const geometry of sources) {
      const attribute = geometry.getAttribute(name);
      array.set(attribute.array, offset);
      offset += attribute.array.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, template.itemSize));
  }

  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

export function paintGeometry(geometry, color) {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function shadowed(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
  return object;
}

/* ------------------------------------------------------------------ *
 *  Procedural canvas textures
 * ------------------------------------------------------------------ */

export function makeTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

export function makeWoodTexture(seed = 3) {
  const rng = createRng(seed);
  return makeTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#70492c';
    ctx.fillRect(0, 0, w, h);

    const logHeight = 64;
    for (let row = 0; row < h / logHeight; row += 1) {
      const y = row * logHeight;
      const base = 62 + Math.floor(rng() * 26);
      ctx.fillStyle = `rgb(${base + 48}, ${base + 14}, ${Math.floor(base * 0.64)})`;
      ctx.fillRect(0, y + 3, w, logHeight - 5);

      // soft light along the upper edge of each log
      const grad = ctx.createLinearGradient(0, y + 3, 0, y + logHeight - 3);
      grad.addColorStop(0, 'rgba(255,220,170,.16)');
      grad.addColorStop(0.45, 'rgba(255,210,160,.025)');
      grad.addColorStop(1, 'rgba(35,15,5,.18)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y + 3, w, logHeight - 5);

      // grain
      for (let i = 0; i < 12; i += 1) {
        ctx.beginPath();
        const yy = y + 8 + rng() * (logHeight - 16);
        ctx.moveTo(0, yy);
        for (let x = 0; x <= w; x += 32) {
          ctx.lineTo(x, yy + Math.sin(x * 0.045 + rng() * 4) * (1 + rng() * 1.5));
        }
        ctx.strokeStyle = `rgba(45,22,9,${0.05 + rng() * 0.12})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // knots
      if (rng() > 0.48) {
        const kx = rng() * w;
        const ky = y + 18 + rng() * 26;
        for (let r = 9; r > 1; r -= 2) {
          ctx.beginPath();
          ctx.ellipse(kx, ky, r * 1.7, r * 0.8, rng() * 0.4, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(50,25,10,${0.18 + (9 - r) * 0.025})`;
          ctx.stroke();
        }
      }

      ctx.fillStyle = 'rgba(26,12,5,.55)';
      ctx.fillRect(0, y, w, 4);
      ctx.fillStyle = 'rgba(255,221,174,.16)';
      ctx.fillRect(0, y + 4, w, 2);
    }
  });
}

export function makeShingleTexture(seed = 8) {
  const rng = createRng(seed);
  return makeTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#334a40';
    ctx.fillRect(0, 0, w, h);
    const rowH = 38;
    const shingleW = 54;
    for (let row = 0; row < Math.ceil(h / rowH); row += 1) {
      const y = row * rowH;
      const offset = row % 2 === 0 ? 0 : -shingleW / 2;
      for (let x = offset; x < w; x += shingleW) {
        const tone = 35 + Math.floor(rng() * 25);
        ctx.fillStyle = `rgb(${tone + 5}, ${tone + 28}, ${tone + 18})`;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, shingleW - 4, rowH - 4, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(224,240,226,.07)';
        ctx.fillRect(x + 5, y + 4, shingleW - 10, 2);
        if (rng() > 0.55) {
          ctx.strokeStyle = 'rgba(15,26,22,.26)';
          ctx.beginPath();
          ctx.moveTo(x + 10 + rng() * 20, y + 8);
          ctx.lineTo(x + 8 + rng() * 25, y + rowH - 7);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(9,18,15,.3)';
      ctx.fillRect(0, y, w, 3);
    }
  });
}

export function makeStoneTexture(seed = 11) {
  const rng = createRng(seed);
  return makeTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5b5b52';
    ctx.fillRect(0, 0, w, h);
    const rows = 7;
    const rowH = h / rows;
    for (let row = 0; row < rows; row += 1) {
      let x = -20 + rng() * 30;
      while (x < w) {
        const stoneW = 48 + rng() * 55;
        const tone = 93 + Math.floor(rng() * 48);
        ctx.fillStyle = `rgb(${tone}, ${tone + 2}, ${tone - 6})`;
        ctx.beginPath();
        ctx.roundRect(x + 3, row * rowH + 4, stoneW - 6, rowH - 8, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(30,30,25,.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,235,.09)';
        ctx.beginPath();
        ctx.ellipse(x + stoneW * 0.35, row * rowH + rowH * 0.3, stoneW * 0.22, 4, -0.2, 0, Math.PI * 2);
        ctx.fill();
        x += stoneW;
      }
      ctx.fillStyle = 'rgba(35,35,30,.6)';
      ctx.fillRect(0, row * rowH - 2, w, 5);
    }
  });
}

export function makeRadialTexture(stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], size = 128) {
  return makeTexture(size, size, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}

export function makeSoftCircleTexture() {
  return makeRadialTexture(
    [
      [0, 'rgba(255,255,255,1)'],
      [0.45, 'rgba(255,255,255,.9)'],
      [0.82, 'rgba(255,255,255,.22)'],
      [1, 'rgba(255,255,255,0)'],
    ],
    96
  );
}

export function makeSmokeTexture() {
  const rng = createRng(22);
  return makeTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 18; i += 1) {
      const x = w * (0.32 + rng() * 0.36);
      const y = h * (0.32 + rng() * 0.36);
      const r = 18 + rng() * 26;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(248,248,242,.32)');
      grad.addColorStop(1, 'rgba(248,248,242,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  });
}

export function makeSignTexture() {
  return makeTexture(640, 320, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#8a5b35');
    grad.addColorStop(1, '#693f24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i += 1) {
      ctx.strokeStyle = `rgba(40,20,8,${0.03 + Math.random() * 0.06})`;
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * h);
      ctx.bezierCurveTo(w * 0.3, Math.random() * h, w * 0.7, Math.random() * h, w, Math.random() * h);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(44,24,12,.75)';
    ctx.lineWidth = 12;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = 'rgba(238,206,150,.3)';
    ctx.lineWidth = 3;
    ctx.strokeRect(25, 25, w - 50, h - 50);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f1dfb4';
    ctx.font = '600 92px "STKaiti", "KaiTi", "Songti SC", serif';
    ctx.fillText('松语小屋', w / 2, h / 2 - 30);
    ctx.fillStyle = 'rgba(241,223,180,.66)';
    ctx.font = '500 30px Georgia, serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('PINEWHISPER', w / 2, h / 2 + 68);
  });
}
