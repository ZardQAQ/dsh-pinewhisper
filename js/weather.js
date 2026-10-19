import * as THREE from 'three';
import {
  createRng,
  range,
  damp,
  dampColor,
  makeSoftCircleTexture,
  clamp,
} from './utils.js';

export const WEATHER_ORDER = ['sunny', 'rain', 'fog', 'snow', 'storm'];

export const WEATHER_META = {
  sunny: {
    name: '晴朗',
    temp: '22°',
    wind: '微风',
    desc: '阳光穿过松针，蜜蜂在花田里打转。',
  },
  rain: {
    name: '细雨',
    temp: '16°',
    wind: '微风',
    desc: '雨点敲着屋檐，林子被打湿成深绿色。',
  },
  fog: {
    name: '薄雾',
    temp: '14°',
    wind: '无风',
    desc: '雾从林间漫上来，小屋的灯先醒了。',
  },
  snow: {
    name: '落雪',
    temp: '-2°',
    wind: '轻风',
    desc: '雪落在屋顶和冷杉上，山谷安静下来。',
  },
  storm: {
    name: '雷雨',
    temp: '13°',
    wind: '疾风',
    desc: '云压得很低，闪电偶尔照亮整片松林。',
  },
};

const CONFIGS = {
  sunny: {
    skyTop: 0x2779c6,
    skyHorizon: 0xc4e6ef,
    fogColor: 0xb7d2c9,
    fogDensity: 0.0052,
    sunColor: 0xfff0c7,
    sunIntensity: 3.15,
    sunX: -24,
    sunY: 30,
    sunZ: 22,
    hemiSky: 0xc3e0f4,
    hemiGround: 0x59724a,
    hemiIntensity: 1.25,
    ambientIntensity: 0.26,
    exposure: 1.04,
    cloudColor: 0xffffff,
    cloudOpacity: 0.34,
    rain: 0,
    snow: 0,
    snowCover: 0,
    wind: 0.55,
    insect: 1,
    windowLight: 0.32,
    pollen: 0.55,
    smoke: 0.34,
    groundWet: 0,
    lightning: 0,
    sunGlow: 1,
    cloudDrift: 0.55,
    rainOpacity: 0,
    snowOpacity: 0,
  },
  rain: {
    skyTop: 0x405763,
    skyHorizon: 0xa4b6b3,
    fogColor: 0x8d9c98,
    fogDensity: 0.0128,
    sunColor: 0xbfccd1,
    sunIntensity: 0.72,
    sunX: -14,
    sunY: 24,
    sunZ: 12,
    hemiSky: 0x91a8b3,
    hemiGround: 0x3f5145,
    hemiIntensity: 0.9,
    ambientIntensity: 0.34,
    exposure: 0.96,
    cloudColor: 0x778489,
    cloudOpacity: 0.86,
    rain: 1,
    snow: 0,
    snowCover: 0,
    wind: 0.95,
    insect: 0.1,
    windowLight: 0.86,
    pollen: 0,
    smoke: 0.58,
    groundWet: 1,
    lightning: 0,
    sunGlow: 0.1,
    cloudDrift: 0.85,
    rainOpacity: 0.5,
    snowOpacity: 0,
  },
  fog: {
    skyTop: 0x7f9998,
    skyHorizon: 0xd2d2c3,
    fogColor: 0xbfc9bd,
    fogDensity: 0.027,
    sunColor: 0xffefc6,
    sunIntensity: 0.9,
    sunX: 16,
    sunY: 22,
    sunZ: 16,
    hemiSky: 0xbdcbc7,
    hemiGround: 0x556352,
    hemiIntensity: 1.18,
    ambientIntensity: 0.34,
    exposure: 1.01,
    cloudColor: 0xd5d7ce,
    cloudOpacity: 0.3,
    rain: 0,
    snow: 0,
    snowCover: 0,
    wind: 0.22,
    insect: 0.75,
    windowLight: 0.8,
    pollen: 0.12,
    smoke: 0.72,
    groundWet: 0.22,
    lightning: 0,
    sunGlow: 0.4,
    cloudDrift: 0.25,
    rainOpacity: 0,
    snowOpacity: 0,
  },
  snow: {
    skyTop: 0x718b9f,
    skyHorizon: 0xd5e4e9,
    fogColor: 0xc8d6dc,
    fogDensity: 0.009,
    sunColor: 0xdceaf5,
    sunIntensity: 1.55,
    sunX: -18,
    sunY: 25,
    sunZ: 19,
    hemiSky: 0xbfd4e1,
    hemiGround: 0x596a60,
    hemiIntensity: 1.35,
    ambientIntensity: 0.38,
    exposure: 1.02,
    cloudColor: 0xd4dde2,
    cloudOpacity: 0.74,
    rain: 0,
    snow: 1,
    snowCover: 1,
    wind: 0.46,
    insect: 0,
    windowLight: 1.05,
    pollen: 0,
    smoke: 0.78,
    groundWet: 0.12,
    lightning: 0,
    sunGlow: 0.25,
    cloudDrift: 0.4,
    rainOpacity: 0,
    snowOpacity: 0.95,
  },
  storm: {
    skyTop: 0x111a23,
    skyHorizon: 0x394d55,
    fogColor: 0x2b3b41,
    fogDensity: 0.0185,
    sunColor: 0x9db7c6,
    sunIntensity: 0.3,
    sunX: -20,
    sunY: 20,
    sunZ: -12,
    hemiSky: 0x617985,
    hemiGround: 0x26352c,
    hemiIntensity: 0.62,
    ambientIntensity: 0.25,
    exposure: 0.9,
    cloudColor: 0x303e45,
    cloudOpacity: 0.94,
    rain: 1,
    snow: 0,
    snowCover: 0,
    wind: 1.42,
    insect: 0,
    windowLight: 1.3,
    pollen: 0,
    smoke: 0.86,
    groundWet: 1,
    lightning: 1,
    sunGlow: 0,
    cloudDrift: 1.2,
    rainOpacity: 0.72,
    snowOpacity: 0,
  },
};

const COLOR_KEYS = [
  'skyTop',
  'skyHorizon',
  'fogColor',
  'sunColor',
  'hemiSky',
  'hemiGround',
  'cloudColor',
];

const NUMBER_KEYS = [
  'fogDensity',
  'sunIntensity',
  'sunX',
  'sunY',
  'sunZ',
  'hemiIntensity',
  'ambientIntensity',
  'exposure',
  'cloudOpacity',
  'rain',
  'snow',
  'snowCover',
  'wind',
  'insect',
  'windowLight',
  'pollen',
  'smoke',
  'groundWet',
  'lightning',
  'sunGlow',
  'cloudDrift',
  'rainOpacity',
  'snowOpacity',
];

const SKY_VERTEX = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTopColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform float uSunGlow;
  uniform float uFlash;
  varying vec3 vWorldPosition;

  void main() {
    vec3 dir = normalize(vWorldPosition);
    float elevation = clamp(dir.y, -0.15, 1.0);
    vec3 color = mix(uHorizonColor, uTopColor, smoothstep(-0.08, 0.36, elevation));

    // Warm haze sitting just above the tree line.
    float horizonHaze = pow(1.0 - clamp(abs(dir.y) / 0.3, 0.0, 1.0), 3.0);
    color = mix(color, uHorizonColor, horizonHaze * 0.16);

    float sunAmount = max(dot(dir, normalize(uSunDirection)), 0.0);
    color += uSunColor * pow(sunAmount, 64.0) * 0.75 * uSunGlow;
    color += uSunColor * pow(sunAmount, 7.0) * 0.14 * uSunGlow;

    // A little atmospheric banding keeps the sky from looking like a flat gradient.
    float band = sin(dir.y * 27.0 + dir.x * 4.0) * 0.004;
    color += band * vec3(0.45, 0.55, 0.55);
    color += uFlash * vec3(0.55, 0.66, 0.82);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class WeatherSystem {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.current = {};
    this.target = {};
    this.active = 'sunny';
    this.flash = 0;
    this.flashKick = 0;
    this.nextLightning = 4;
    this.lightningLight = null;
    this.snowFlakes = null;
    this.rainDrops = null;
    this.rainLines = null;
    this.clouds = [];
    this.particlesReady = false;

    for (const key of COLOR_KEYS) {
      this.current[key] = new THREE.Color(CONFIGS.sunny[key]);
      this.target[key] = new THREE.Color(CONFIGS.sunny[key]);
    }
    for (const key of NUMBER_KEYS) {
      this.current[key] = CONFIGS.sunny[key];
      this.target[key] = CONFIGS.sunny[key];
    }

    this.buildSky();
    this.buildLights();
    this.buildClouds();
    this.buildRain();
    this.buildSnow();
    this.buildLightning();
    this.apply(true);
  }

  buildSky() {
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(CONFIGS.sunny.skyTop) },
      uHorizonColor: { value: new THREE.Color(CONFIGS.sunny.skyHorizon) },
      uSunColor: { value: new THREE.Color(CONFIGS.sunny.sunColor) },
      uSunDirection: { value: new THREE.Vector3(-1, 1, 0.7).normalize() },
      uSunGlow: { value: 1 },
      uFlash: { value: 0 },
    };

    const geometry = new THREE.SphereGeometry(400, 32, 20);
    const material = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(geometry, material);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    this.scene.add(this.sky);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(
      CONFIGS.sunny.hemiSky,
      CONFIGS.sunny.hemiGround,
      CONFIGS.sunny.hemiIntensity
    );
    this.hemi.position.set(0, 22, 0);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(
      CONFIGS.sunny.sunColor,
      CONFIGS.sunny.sunIntensity
    );
    this.sun.position.set(
      CONFIGS.sunny.sunX,
      CONFIGS.sunny.sunY,
      CONFIGS.sunny.sunZ
    );
    this.sun.castShadow = true;
    const shadowSize = window.innerWidth < 760 ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.camera.left = -25;
    this.sun.shadow.camera.right = 25;
    this.sun.shadow.camera.top = 25;
    this.sun.shadow.camera.bottom = -25;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 95;
    this.sun.shadow.bias = -0.00045;
    this.sun.shadow.normalBias = 0.035;
    this.sun.target.position.set(0, 1.2, -1);
    this.scene.add(this.sun, this.sun.target);

    this.ambient = new THREE.AmbientLight(0x93aab3, CONFIGS.sunny.ambientIntensity);
    this.scene.add(this.ambient);
  }

  buildClouds() {
    const rng = createRng(83);
    const puffGeometry = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      fog: true,
    });

    for (let i = 0; i < 10; i += 1) {
      const group = new THREE.Group();
      const puffCount = 4 + Math.floor(rng() * 3);
      for (let j = 0; j < puffCount; j += 1) {
        const puff = new THREE.Mesh(puffGeometry, this.cloudMaterial);
        puff.position.set(
          (j - puffCount / 2) * range(rng, 2.2, 3.2),
          range(rng, -0.55, 0.65),
          range(rng, -1.7, 1.7)
        );
        puff.scale.set(range(rng, 2.1, 4.4), range(rng, 1.3, 2.2), range(rng, 1.5, 2.8));
        puff.rotation.set(rng() * 0.5, rng() * Math.PI, rng() * 0.3);
        group.add(puff);
      }
      group.position.set(
        range(rng, -46, 46),
        range(rng, 15, 24),
        range(rng, -58, -28)
      );
      group.scale.setScalar(range(rng, 0.5, 0.95));
      group.userData.speed = range(rng, 0.22, 0.6);
      this.clouds.push(group);
      this.scene.add(group);
    }
  }

  buildRain() {
    const rng = createRng(109);
    const count = 1500;
    const positions = new Float32Array(count * 2 * 3);
    const drops = [];
    for (let i = 0; i < count; i += 1) {
      drops.push({
        x: range(rng, -28, 28),
        y: range(rng, 0, 25),
        z: range(rng, -22, 20),
        speed: range(rng, 12, 22),
        length: range(rng, 0.55, 1.35),
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xd4e2e8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: true,
    });
    this.rainLines = new THREE.LineSegments(geometry, material);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.rainDrops = drops;
    this.rainPositions = positions;
    this.scene.add(this.rainLines);
  }

  buildSnow() {
    const rng = createRng(141);
    const count = 1300;
    const positions = new Float32Array(count * 3);
    const flakes = [];
    for (let i = 0; i < count; i += 1) {
      flakes.push({
        x: range(rng, -30, 30),
        y: range(rng, 0, 25),
        z: range(rng, -24, 22),
        speed: range(rng, 0.65, 1.55),
        phase: range(rng, 0, Math.PI * 2),
        sway: range(rng, 0.2, 0.9),
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.18,
      map: makeSoftCircleTexture(),
      transparent: true,
      opacity: 0,
      alphaTest: 0.02,
      depthWrite: false,
      sizeAttenuation: true,
      fog: true,
    });
    this.snowFlakes = new THREE.Points(geometry, material);
    this.snowFlakes.frustumCulled = false;
    this.snowFlakes.visible = false;
    this.snowParticles = flakes;
    this.snowPositions = positions;
    this.scene.add(this.snowFlakes);
  }

  buildLightning() {
    this.lightningLight = new THREE.DirectionalLight(0xe6f0ff, 0);
    this.lightningLight.position.set(8, 28, -18);
    this.scene.add(this.lightningLight);
  }

  setWeather(name, immediate = false) {
    if (!CONFIGS[name]) return;
    this.active = name;
    const config = CONFIGS[name];
    for (const key of COLOR_KEYS) this.target[key].set(config[key]);
    for (const key of NUMBER_KEYS) this.target[key] = config[key];
    if (immediate) {
      for (const key of COLOR_KEYS) this.current[key].copy(this.target[key]);
      for (const key of NUMBER_KEYS) this.current[key] = this.target[key];
      this.apply(true);
    }
    if (name === 'storm') this.nextLightning = 2.2;
  }

  apply() {
    const c = this.current;
    this.skyUniforms.uTopColor.value.copy(c.skyTop);
    this.skyUniforms.uHorizonColor.value.copy(c.skyHorizon);
    this.skyUniforms.uSunColor.value.copy(c.sunColor);
    this.skyUniforms.uSunGlow.value = c.sunGlow;
    this.skyUniforms.uSunDirection.value
      .set(c.sunX, c.sunY, c.sunZ)
      .normalize();

    this.scene.fog.color.copy(c.fogColor);
    this.scene.fog.density = c.fogDensity;
    this.scene.background.copy(c.fogColor);

    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.hemi.intensity = c.hemiIntensity;

    this.sun.color.copy(c.sunColor);
    this.sun.intensity = c.sunIntensity;
    this.sun.position.set(c.sunX, c.sunY, c.sunZ);

    this.ambient.intensity = c.ambientIntensity;
    this.renderer.toneMappingExposure = c.exposure;

    this.cloudMaterial.color.copy(c.cloudColor);
    this.cloudMaterial.opacity = c.cloudOpacity;

    this.rainLines.visible = c.rain > 0.015;
    this.rainLines.material.opacity = c.rainOpacity;
    this.snowFlakes.visible = c.snow > 0.015;
    this.snowFlakes.material.opacity = c.snowOpacity;
  }

  update(dt, time) {
    const lambda = 1.45;
    for (const key of COLOR_KEYS) {
      dampColor(this.current[key], this.target[key], lambda, dt);
    }
    for (const key of NUMBER_KEYS) {
      this.current[key] = damp(this.current[key], this.target[key], lambda, dt);
    }

    // Lightning flashes light the sky, the scene, and the CSS vignette.
    if (this.current.lightning > 0.6 && this.current.rain > 0.35) {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.flash = 1;
        this.flashKick = 0.11;
        this.nextLightning = 4.2 + Math.random() * 7.5;
      }
    }
    if (this.flashKick > 0) {
      this.flashKick -= dt;
      this.flash = Math.max(this.flash, 0.78);
    } else {
      this.flash *= Math.exp(-dt * 8.5);
    }
    this.skyUniforms.uFlash.value = this.flash * 0.24;
    this.lightningLight.intensity = this.flash * 5.5;
    const flashNode = document.getElementById('sky-flash');
    if (flashNode) flashNode.style.opacity = String(clamp(this.flash * 0.2, 0, 0.3));

    this.apply();
    this.updateClouds(dt);
    this.updateRain(dt);
    this.updateSnow(dt, time);
  }

  updateClouds(dt) {
    const c = this.current;
    for (const cloud of this.clouds) {
      cloud.position.x += dt * (0.12 + c.cloudDrift * 0.42) * cloud.userData.speed;
      if (cloud.position.x > 58) cloud.position.x = -58;
    }
  }

  updateRain(dt) {
    if (this.current.rain <= 0.015) return;
    const drops = this.rainDrops;
    const positions = this.rainPositions;
    const wind = this.current.wind;
    for (let i = 0; i < drops.length; i += 1) {
      const drop = drops[i];
      drop.y -= drop.speed * dt;
      drop.x += wind * dt * 2.1;
      if (drop.y < -0.4) {
        drop.y = 23 + Math.random() * 7;
        drop.x = -28 + Math.random() * 56;
        drop.z = -22 + Math.random() * 42;
      }
      if (drop.x > 30) drop.x = -30;
      const offset = i * 6;
      positions[offset] = drop.x;
      positions[offset + 1] = drop.y;
      positions[offset + 2] = drop.z;
      positions[offset + 3] = drop.x + wind * 0.16;
      positions[offset + 4] = drop.y - drop.length;
      positions[offset + 5] = drop.z;
    }
    this.rainLines.geometry.attributes.position.needsUpdate = true;
  }

  updateSnow(dt, time) {
    if (this.current.snow <= 0.015) return;
    const particles = this.snowParticles;
    const positions = this.snowPositions;
    for (let i = 0; i < particles.length; i += 1) {
      const particle = particles[i];
      particle.y -= particle.speed * dt;
      particle.x += Math.sin(time * 0.55 + particle.phase) * particle.sway * dt;
      if (particle.y < 0.05) {
        particle.y = 20 + Math.random() * 8;
        particle.x = -30 + Math.random() * 60;
        particle.z = -24 + Math.random() * 46;
      }
      const offset = i * 3;
      positions[offset] = particle.x;
      positions[offset + 1] = particle.y;
      positions[offset + 2] = particle.z;
    }
    this.snowFlakes.geometry.attributes.position.needsUpdate = true;
  }
}
