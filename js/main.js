import * as THREE from 'three';
import { createWorld } from './world.js';
import { WeatherSystem, WEATHER_ORDER, WEATHER_META } from './weather.js';

const canvas = document.getElementById('scene');
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loader-bar');
const loaderPercent = document.getElementById('loader-percent');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
  stencil: false,
});
const getPixelRatio = () =>
  Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 1.8);
renderer.setPixelRatio(getPixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb7d2c9);
scene.fog = new THREE.FogExp2(0xb7d2c9, 0.0052);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  700
);
const initialTheta = 0.2;
const initialPhi = 1.4;
const initialRadius = 24.5;
camera.position.set(
  Math.sin(initialPhi) * Math.sin(initialTheta) * initialRadius,
  3.1 + Math.cos(initialPhi) * initialRadius,
  -2.2 + Math.sin(initialPhi) * Math.cos(initialTheta) * initialRadius
);
camera.lookAt(0, 3.1, -2.2);

/* ------------------------------------------------------------------ *
 *  A small, dependency-free orbit rig with inertia and idle drift
 * ------------------------------------------------------------------ */

class ForestOrbit {
  constructor(controlledCamera, element) {
    this.camera = controlledCamera;
    this.element = element;
    this.target = new THREE.Vector3(0, 3.15, -2.2);
    this.theta = initialTheta;
    this.phi = initialPhi;
    this.radius = initialRadius;
    this.desiredTheta = initialTheta;
    this.desiredPhi = initialPhi;
    this.desiredRadius = initialRadius;
    this.lastInteraction = performance.now();
    this.dragging = false;
    this.pointers = new Map();
    this.pinchDistance = 0;
    this.spherical = new THREE.Spherical();
    this.offset = new THREE.Vector3();
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    element.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    window.addEventListener('pointermove', (event) => this.onPointerMove(event));
    window.addEventListener('pointerup', (event) => this.onPointerUp(event));
    window.addEventListener('pointercancel', (event) => this.onPointerUp(event));
    element.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    element.addEventListener('contextmenu', (event) => event.preventDefault());
    element.addEventListener('dblclick', () => this.reset());
  }

  onPointerDown(event) {
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.element.setPointerCapture?.(event.pointerId);
    if (this.pointers.size === 1) {
      this.dragging = true;
      this.dragX = event.clientX;
      this.dragY = event.clientY;
    }
    this.lastInteraction = performance.now();
    document.body.classList.add('is-exploring');
  }

  onPointerMove(event) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.lastInteraction = performance.now();

    if (this.pointers.size >= 2) {
      const values = [...this.pointers.values()];
      const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      if (this.pinchDistance > 0) {
        this.desiredRadius = THREE.MathUtils.clamp(
          this.desiredRadius * (this.pinchDistance / distance),
          12,
          36
        );
      }
      this.pinchDistance = distance;
      return;
    }

    if (!this.dragging) return;
    const dx = event.clientX - this.dragX;
    const dy = event.clientY - this.dragY;
    this.dragX = event.clientX;
    this.dragY = event.clientY;
    this.desiredTheta -= dx * 0.005;
    this.desiredPhi = THREE.MathUtils.clamp(this.desiredPhi - dy * 0.004, 0.58, 1.5);
  }

  onPointerUp(event) {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchDistance = 0;
    if (this.pointers.size === 0) this.dragging = false;
    this.lastInteraction = performance.now();
  }

  onWheel(event) {
    event.preventDefault();
    this.desiredRadius = THREE.MathUtils.clamp(
      this.desiredRadius + event.deltaY * 0.016,
      12,
      36
    );
    this.lastInteraction = performance.now();
    document.body.classList.add('is-exploring');
  }

  reset() {
    this.desiredTheta = initialTheta;
    this.desiredPhi = initialPhi;
    this.desiredRadius = initialRadius;
    this.lastInteraction = performance.now();
  }

  update(dt, elapsed) {
    const idle = performance.now() - this.lastInteraction > 3800;
    if (idle && !this.dragging && this.pointers.size === 0 && !this.prefersReducedMotion) {
      this.desiredTheta += dt * 0.028;
    }
    const response = 1 - Math.exp(-dt * 7);
    this.theta += (this.desiredTheta - this.theta) * response;
    this.phi += (this.desiredPhi - this.phi) * response;
    this.radius += (this.desiredRadius - this.radius) * response;

    this.target.y = 3.15 + Math.sin(elapsed * 0.28) * 0.045;
    this.spherical.set(this.radius, this.phi, this.theta);
    this.offset.setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
  }
}

const controls = new ForestOrbit(camera, canvas);

/* ------------------------------------------------------------------ *
 *  World + weather
 * ------------------------------------------------------------------ */

const progress = { value: 18 };
function setProgress(value) {
  progress.value = value;
  if (loaderBar) loaderBar.style.width = `${value}%`;
  if (loaderPercent) loaderPercent.textContent = `${Math.round(value)}%`;
}

setProgress(32);
const world = createWorld(scene);
setProgress(66);

const weather = new WeatherSystem(scene, renderer);
setProgress(88);

const params = new URLSearchParams(window.location.search);
const requestedWeather = params.get('weather');
const initialWeather = WEATHER_ORDER.includes(requestedWeather) ? requestedWeather : 'sunny';
weather.setWeather(initialWeather, true);

/* ------------------------------------------------------------------ *
 *  UI
 * ------------------------------------------------------------------ */

const weatherButtons = [...document.querySelectorAll('.weather-button[data-weather]')];
const weatherName = document.getElementById('weather-name');
const weatherTemp = document.getElementById('weather-temp');
const weatherWind = document.getElementById('weather-wind');
const weatherDesc = document.getElementById('weather-desc');
const readout = document.getElementById('weather-readout');
const autoButton = document.getElementById('auto-cycle');
const autoLabel = document.getElementById('auto-label');
let autoCycle = false;
let autoElapsed = 0;
let activeWeather = initialWeather;

function syncWeatherUI(name, animate = true) {
  const meta = WEATHER_META[name];
  if (!meta) return;
  activeWeather = name;
  document.body.dataset.weather = name;
  for (const button of weatherButtons) {
    const selected = button.dataset.weather === name;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  }
  if (weatherName) {
    weatherName.textContent = meta.name;
    if (animate && readout) {
      readout.classList.remove('is-swapping');
      // Force a reflow so repeated weather changes replay the fade.
      void readout.offsetWidth;
      readout.classList.add('is-swapping');
    }
  }
  if (weatherTemp) weatherTemp.textContent = meta.temp;
  if (weatherWind) weatherWind.textContent = meta.wind;
  if (weatherDesc) weatherDesc.textContent = meta.desc;
}

function chooseWeather(name, userInitiated = true) {
  if (!WEATHER_META[name]) return;
  weather.setWeather(name);
  syncWeatherUI(name);
  autoElapsed = 0;
  if (autoCycle && !userInitiated) {
    // The next auto tick starts from now.
  }
  renderer.shadowMap.needsUpdate = true;
}

for (const button of weatherButtons) {
  button.addEventListener('click', () => chooseWeather(button.dataset.weather));
}

function setAutoCycle(enabled) {
  autoCycle = enabled;
  autoElapsed = 0;
  autoButton?.classList.toggle('is-on', enabled);
  autoButton?.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  if (autoLabel) autoLabel.textContent = enabled ? '自动轮换中' : '自动轮换';
}

autoButton?.addEventListener('click', () => setAutoCycle(!autoCycle));

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < WEATHER_ORDER.length) {
    chooseWeather(WEATHER_ORDER[index]);
  } else if (event.key === '0') {
    setAutoCycle(!autoCycle);
  } else if (event.key.toLowerCase() === 'r') {
    controls.reset();
  }
});

syncWeatherUI(initialWeather, false);

/* ------------------------------------------------------------------ *
 *  Sizing / animation
 * ------------------------------------------------------------------ */

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(getPixelRatio());
  renderer.setSize(width, height);
}
window.addEventListener('resize', onResize);

const clock = new THREE.Clock();
let elapsed = 0;
let frame = 0;
let firstFrame = true;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  controls.update(dt, elapsed);
  weather.update(dt, elapsed);
  world.update(dt, elapsed, weather.current);

  if (autoCycle) {
    autoElapsed += dt;
    if (autoElapsed > 26) {
      autoElapsed = 0;
      const currentIndex = WEATHER_ORDER.indexOf(activeWeather);
      chooseWeather(WEATHER_ORDER[(currentIndex + 1) % WEATHER_ORDER.length], false);
    }
  }

  if (frame % 6 === 0 || firstFrame) {
    renderer.shadowMap.needsUpdate = true;
  }

  renderer.render(scene, camera);
  frame += 1;

  if (firstFrame) {
    firstFrame = false;
    setProgress(100);
    window.setTimeout(() => {
      loader?.classList.add('is-hidden');
      document.body.classList.add('is-ready');
      window.setTimeout(() => loader?.remove(), 1500);
    }, 450);
  }
}

window.addEventListener('error', (event) => {
  const label = loader?.querySelector('.loader-status');
  if (label) label.textContent = `场景加载遇到问题：${event.message}`;
  loader?.classList.add('has-error');
});

// A tiny public handle is useful for screenshots, debugging and embedding.
window.__forest = {
  scene,
  camera,
  renderer,
  weather,
  world,
  controls,
  chooseWeather,
  setAutoCycle,
  get activeWeather() {
    return activeWeather;
  },
};

setProgress(94);
renderer.setAnimationLoop(animate);
