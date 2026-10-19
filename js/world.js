import * as THREE from 'three';
import {
  createRng,
  range,
  pick,
  clamp,
  smoothstep,
  mergeGeometries,
  paintGeometry,
  makeWoodTexture,
  makeShingleTexture,
  makeStoneTexture,
  makeSignTexture,
  makeTexture,
  makeRadialTexture,
  makeSoftCircleTexture,
  makeSmokeTexture,
} from './utils.js';

const UP = new THREE.Vector3(0, 1, 0);

function addMesh(parent, geometry, material, position = [0, 0, 0], cast = true, receive = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function cylinderBetween(parent, start, end, radiusStart, radiusEnd, material, radialSegments = 6) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radiusEnd, radiusStart, length, radialSegments, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function softMat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    flatShading: true,
    ...options,
  });
}

function addSphere(parent, material, scale, position, segments = 8) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.max(4, segments - 2)), material);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/* ------------------------------------------------------------------ *
 *  The world
 * ------------------------------------------------------------------ */

export function createWorld(scene) {
  const rng = createRng(62041);
  const root = new THREE.Group();
  root.name = 'Pinewhisper clearing';
  scene.add(root);

  const snowMeshes = [];
  const snowCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2f6f4,
    roughness: 0.82,
    metalness: 0,
    transparent: true,
    opacity: 0,
    flatShading: true,
  });

  const flowerHeads = [];
  const flowers = [];
  const trees = [];
  const butterflies = [];
  const bees = [];
  const smoke = [];
  const grassUniforms = { uTime: { value: 0 }, uWind: { value: 0.5 } };

  function terrainHeight(x, z) {
    const distance = Math.hypot(x * 0.85, (z + 2) * 0.72);
    const rim = smoothstep(12, 37, distance) * 3.6;
    const ripple =
      Math.sin(x * 0.28 + z * 0.14) * 0.1 +
      Math.sin(z * 0.33 - x * 0.11) * 0.075 +
      Math.cos(x * 0.71 + z * 0.43) * 0.035;
    return rim + ripple;
  }

  /* ---------------------------------------------------------------- *
   *  Ground and path
   * ---------------------------------------------------------------- */

  const groundGeometry = new THREE.PlaneGeometry(112, 112, 110, 110);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundPositions = groundGeometry.getAttribute('position');
  const groundColors = new Float32Array(groundPositions.count * 3);
  const grassA = new THREE.Color(0x4d6a34);
  const grassB = new THREE.Color(0x718d48);
  const earth = new THREE.Color(0x8a7650);
  const moss = new THREE.Color(0x35502d);
  const tmpColor = new THREE.Color();
  for (let i = 0; i < groundPositions.count; i += 1) {
    const x = groundPositions.getX(i);
    const z = groundPositions.getZ(i);
    groundPositions.setY(i, terrainHeight(x, z));
    const noise =
      Math.sin(x * 1.73 + z * 0.83) * 0.5 +
      Math.sin(z * 2.11 - x * 0.61) * 0.3 +
      Math.sin(x * 4.2 + z * 3.7) * 0.2;
    tmpColor.copy(grassA).lerp(grassB, clamp(0.5 + noise * 0.4, 0, 1));
    if (noise > 0.55) tmpColor.lerp(earth, (noise - 0.55) * 0.6);
    if (noise < -0.55) tmpColor.lerp(moss, (-noise - 0.55) * 0.45);
    groundColors[i * 3] = tmpColor.r;
    groundColors[i * 3 + 1] = tmpColor.g;
    groundColors[i * 3 + 2] = tmpColor.b;
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
  groundGeometry.computeVertexNormals();

  const groundTexture = makeTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#b6b7aa';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 850; i += 1) {
      const x = rng() * w;
      const y = rng() * h;
      const radius = 2 + rng() * 26;
      ctx.fillStyle = rng() > 0.5 ? `rgba(250,247,225,${0.018 + rng() * 0.045})` : `rgba(38,60,28,${0.02 + rng() * 0.05})`;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * (0.3 + rng() * 0.7), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 2200; i += 1) {
      const x = rng() * w;
      const y = rng() * h;
      ctx.strokeStyle = rng() > 0.45 ? 'rgba(242,240,218,.1)' : 'rgba(36,56,26,.12)';
      ctx.lineWidth = 0.7 + rng();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 4, y - 1 - rng() * 7);
      ctx.stroke();
    }
  });
  groundTexture.repeat.set(24, 24);
  const groundMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: groundTexture,
    roughness: 0.97,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.receiveShadow = true;
  root.add(ground);

  const snowGroundMaterial = new THREE.MeshStandardMaterial({
    color: 0xeef4f2,
    roughness: 0.9,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const snowGround = new THREE.Mesh(groundGeometry, snowGroundMaterial);
  snowGround.position.y = 0.055;
  snowGround.receiveShadow = true;
  snowGround.renderOrder = 2;
  snowGround.visible = false;
  root.add(snowGround);

  const pathPoints = [
    new THREE.Vector3(0.1, 0.04, -6.2),
    new THREE.Vector3(0.25, 0.04, -3.5),
    new THREE.Vector3(0.1, 0.04, -0.8),
    new THREE.Vector3(-0.9, 0.04, 2.0),
    new THREE.Vector3(-0.45, 0.04, 5.1),
    new THREE.Vector3(0.85, 0.04, 8.4),
    new THREE.Vector3(1.25, 0.04, 12.2),
    new THREE.Vector3(0.65, 0.04, 16.0),
  ];
  const pathCurve = new THREE.CatmullRomCurve3(pathPoints);
  const pathSegments = 90;
  const pathVertices = [];
  const pathColors = [];
  const pathIndices = [];
  const pathColorA = new THREE.Color(0xa0845c);
  const pathColorB = new THREE.Color(0xc2a980);
  for (let i = 0; i <= pathSegments; i += 1) {
    const t = i / pathSegments;
    const point = pathCurve.getPointAt(t);
    const tangent = pathCurve.getTangentAt(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const width = 1.7 + Math.sin(t * 11) * 0.16 + Math.sin(t * 37) * 0.08;
    for (const sign of [-1, 1]) {
      const p = point.clone().addScaledVector(side, sign * width * 0.5);
      p.y = 0.045;
      pathVertices.push(p.x, p.y, p.z);
      const c = pathColorA.clone().lerp(pathColorB, 0.5 + Math.sin(t * 40 + sign) * 0.35);
      pathColors.push(c.r, c.g, c.b);
    }
    if (i < pathSegments) {
      const base = i * 2;
      pathIndices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);
    }
  }
  const pathGeometry = new THREE.BufferGeometry();
  pathGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pathVertices, 3));
  pathGeometry.setAttribute('color', new THREE.Float32BufferAttribute(pathColors, 3));
  pathGeometry.setIndex(pathIndices);
  pathGeometry.computeVertexNormals();
  const pathMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
  const path = new THREE.Mesh(pathGeometry, pathMaterial);
  path.receiveShadow = true;
  root.add(path);

  // Warm stepping stones right in front of the porch.
  const stoneMaterial = new THREE.MeshStandardMaterial({
    map: makeStoneTexture(5),
    roughness: 0.95,
    metalness: 0,
  });
  for (let i = 0; i < 5; i += 1) {
    const stone = addMesh(
      root,
      new THREE.CylinderGeometry(0.42 + rng() * 0.14, 0.48 + rng() * 0.12, 0.12, 9),
      stoneMaterial,
      [0 + (rng() - 0.5) * 0.35, 0.08, 3.05 + i * 0.72],
      false,
      true
    );
    stone.rotation.y = rng() * Math.PI;
    stone.scale.z = 0.72;
  }

  const puddleMaterial = new THREE.MeshStandardMaterial({
    color: 0x759097,
    roughness: 0.12,
    metalness: 0.28,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const puddles = new THREE.Group();
  const puddleSpots = [
    [-2.9, 5.6, 1.2, 0.55],
    [2.8, 1.1, 0.85, 0.4],
    [-4.6, 0.4, 1.55, 0.62],
    [4.7, 7.4, 1.25, 0.52],
    [0.7, 10.2, 0.9, 0.42],
    [-1.0, -2.5, 0.8, 0.35],
  ];
  for (const [x, z, sx, sz] of puddleSpots) {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 22), puddleMaterial);
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, 0.072, z);
    puddle.scale.set(sx, sz, 1);
    puddles.add(puddle);
  }
  puddles.visible = false;
  root.add(puddles);

  /* ---------------------------------------------------------------- *
   *  The cottage
   * ---------------------------------------------------------------- */

  const cabin = new THREE.Group();
  cabin.position.set(0, 0, -12);
  root.add(cabin);
  const cabinRng = createRng(417);

  const woodTexture = makeWoodTexture(17);
  const shingleTexture = makeShingleTexture(4);
  shingleTexture.repeat.set(2.3, 2.1);
  const stoneTexture = makeStoneTexture(8);
  stoneTexture.repeat.set(1.6, 1.2);

  const woodMaterials = [
    new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xb58b63, roughness: 0.86 }),
    new THREE.MeshStandardMaterial({ map: woodTexture, color: 0x99724f, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: woodTexture, color: 0xc29a6e, roughness: 0.88 }),
  ];
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x4d3221, roughness: 0.9 });
  const roofMaterial = new THREE.MeshStandardMaterial({ map: shingleTexture, color: 0x93a99a, roughness: 0.88 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTexture, color: 0xa3a79c, roughness: 0.95 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x5f3f28, roughness: 0.84 });
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x5d3e20,
    emissive: 0xffb45b,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.05,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f2a21,
    roughness: 0.55,
    metalness: 0.65,
  });
  const brassMaterial = new THREE.MeshStandardMaterial({
    color: 0xb98b45,
    roughness: 0.34,
    metalness: 0.8,
  });
  const warmGlowTexture = makeRadialTexture(
    [
      [0, 'rgba(255,211,139,.9)'],
      [0.35, 'rgba(255,176,90,.42)'],
      [1, 'rgba(255,148,60,0)'],
    ],
    128
  );
  const windowGlowMaterial = new THREE.SpriteMaterial({
    map: warmGlowTexture,
    color: 0xffc477,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Foundation
  addMesh(cabin, new THREE.BoxGeometry(7.7, 0.7, 5.8), stoneMat, [0, 0.35, 0]);
  // Main body
  addMesh(cabin, new THREE.BoxGeometry(7.0, 3.8, 5.3), woodMaterials[1], [0, 2.45, 0]);

  // Stacked log edges bring the wall texture into real 3D.
  for (let row = 0; row < 10; row += 1) {
    const y = 0.78 + row * 0.345;
    const material = woodMaterials[row % 3];
    const frontLog = addMesh(
      cabin,
      new THREE.CylinderGeometry(0.17, 0.19, 7.18, 7),
      material,
      [0, y, 2.68],
      row % 2 === 0,
      true
    );
    frontLog.rotation.z = Math.PI / 2;
    const backLog = addMesh(
      cabin,
      new THREE.CylinderGeometry(0.16, 0.18, 7.18, 7),
      material,
      [0, y, -2.68],
      false,
      true
    );
    backLog.rotation.z = Math.PI / 2;
    if (row < 8) {
      for (const x of [-3.58, 3.58]) {
        const sideLog = addMesh(
          cabin,
          new THREE.CylinderGeometry(0.16, 0.18, 5.16, 7),
          material,
          [x, y, 0],
          row % 2 === 1,
          true
        );
        sideLog.rotation.x = Math.PI / 2;
      }
    }
  }

  // Corner beams and vertical trim
  for (const x of [-3.52, 3.52]) {
    for (const z of [-2.64, 2.64]) {
      addMesh(cabin, new THREE.BoxGeometry(0.25, 3.9, 0.25), trimMaterial, [x, 2.4, z]);
    }
  }

  // Gable walls
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-3.5, 4.28);
  gableShape.lineTo(3.5, 4.28);
  gableShape.lineTo(0, 6.8);
  gableShape.lineTo(-3.5, 4.28);
  const gableGeometry = new THREE.ShapeGeometry(gableShape);
  for (const z of [2.66, -2.66]) {
    const gable = addMesh(cabin, gableGeometry, woodMaterials[2], [0, 0, z], false, true);
    gable.material.side = THREE.DoubleSide;
    if (z < 0) gable.rotation.y = Math.PI;
  }

  // Roof planes
  const roofAngle = Math.atan2(2.5, 4.45);
  const roofLength = Math.hypot(2.5, 4.45) + 0.5;
  for (const side of [-1, 1]) {
    const roof = addMesh(
      cabin,
      new THREE.BoxGeometry(roofLength, 0.2, 6.55),
      roofMaterial,
      [side * 2.18, 5.56, 0]
    );
    roof.rotation.z = side * -roofAngle;
    roof.castShadow = true;
    roof.receiveShadow = true;
    // Snow lying on top of each roof plane.
    const snowRoof = addMesh(
      cabin,
      new THREE.BoxGeometry(roofLength - 0.25, 0.08, 6.38),
      snowCapMaterial,
      [side * 2.18, 5.68, 0],
      false,
      false
    );
    snowRoof.rotation.z = side * -roofAngle;
    snowMeshes.push(snowRoof);
  }
  addMesh(cabin, new THREE.CylinderGeometry(0.16, 0.18, 6.7, 7), darkWood, [0, 7.08, 0]).rotation.x = Math.PI / 2;

  // Chimney
  addMesh(cabin, new THREE.BoxGeometry(1.1, 3.35, 1.05), stoneMat, [2.25, 6.35, -1.15]);
  addMesh(cabin, new THREE.BoxGeometry(1.36, 0.25, 1.3), stoneMat, [2.25, 8.03, -1.15]);
  const chimneySnow = addMesh(
    cabin,
    new THREE.BoxGeometry(1.4, 0.12, 1.34),
    snowCapMaterial,
    [2.25, 8.22, -1.15],
    false,
    false
  );
  snowMeshes.push(chimneySnow);

  // Door
  addMesh(cabin, new THREE.BoxGeometry(1.65, 2.55, 0.16), trimMaterial, [0, 1.55, 2.94]);
  addMesh(cabin, new THREE.BoxGeometry(1.36, 2.32, 0.13), woodMaterials[0], [0, 1.46, 3.03]);
  const doorWindow = addMesh(cabin, new THREE.CircleGeometry(0.24, 16), windowMaterial, [0, 1.92, 3.11], false, false);
  doorWindow.scale.y = 1.12;
  addMesh(cabin, new THREE.TorusGeometry(0.27, 0.035, 6, 18), trimMaterial, [0, 1.92, 3.13]);
  addMesh(cabin, new THREE.SphereGeometry(0.055, 8, 6), brassMaterial, [0.48, 1.43, 3.14], false, false);
  addMesh(cabin, new THREE.BoxGeometry(1.5, 0.13, 0.5), stoneMat, [0, 0.24, 3.12], false, true);

  // Windows
  const tinyFlowerMaterials = new Map();
  function makeWindow(x) {
    addMesh(cabin, new THREE.BoxGeometry(1.62, 1.62, 0.13), trimMaterial, [x, 2.65, 2.95]);
    addMesh(cabin, new THREE.BoxGeometry(1.32, 1.32, 0.15), windowMaterial, [x, 2.65, 3.03], false, false);
    addMesh(cabin, new THREE.BoxGeometry(0.08, 1.4, 0.08), trimMaterial, [x, 2.65, 3.09]);
    addMesh(cabin, new THREE.BoxGeometry(1.4, 0.08, 0.08), trimMaterial, [x, 2.65, 3.09]);
    addMesh(cabin, new THREE.BoxGeometry(1.95, 0.16, 0.35), woodMaterials[2], [x, 1.76, 3.15]);
    addMesh(cabin, new THREE.BoxGeometry(1.82, 0.25, 0.28), darkWood, [x, 1.62, 3.15]);
    const glow = new THREE.Sprite(windowGlowMaterial);
    glow.position.set(x, 2.65, 3.18);
    glow.scale.set(3.5, 3.5, 1);
    cabin.add(glow);
    // Tiny blossoms in the window box.
    const blossomColors = [0xe98073, 0xf2bd5d, 0xf4e6cb];
    for (let i = 0; i < 9; i += 1) {
      const blossom = makeTinyFlower(
        pick(cabinRng, blossomColors),
        0.07 + cabinRng() * 0.035
      );
      blossom.position.set(x - 0.78 + i * 0.195, 1.82 + cabinRng() * 0.12, 3.3);
      cabin.add(blossom);
    }
  }
  makeWindow(-2.05);
  makeWindow(2.05);

  // Small round window in the gable.
  addMesh(cabin, new THREE.TorusGeometry(0.55, 0.075, 7, 24), trimMaterial, [0, 5.38, 2.7]);
  const roundWindow = addMesh(cabin, new THREE.CircleGeometry(0.49, 24), windowMaterial, [0, 5.38, 2.73], false, false);
  roundWindow.scale.y = 1;
  addMesh(cabin, new THREE.BoxGeometry(0.07, 0.9, 0.06), trimMaterial, [0, 5.38, 2.79]);
  addMesh(cabin, new THREE.BoxGeometry(0.9, 0.07, 0.06), trimMaterial, [0, 5.38, 2.79]);

  // Porch deck, steps, posts and beam.
  addMesh(cabin, new THREE.BoxGeometry(7.9, 0.25, 1.95), woodMaterials[1], [0, 0.72, 3.38]);
  addMesh(cabin, new THREE.BoxGeometry(2.3, 0.22, 0.55), woodMaterials[2], [0, 0.44, 4.55]);
  addMesh(cabin, new THREE.BoxGeometry(2.3, 0.2, 0.5), stoneMat, [0, 0.24, 4.95], false, true);
  for (const x of [-3.45, 3.45]) {
    addMesh(cabin, new THREE.CylinderGeometry(0.14, 0.18, 2.8, 7), woodMaterials[0], [x, 2.15, 4.05]);
    addMesh(cabin, new THREE.CylinderGeometry(0.24, 0.28, 0.22, 7), stoneMat, [x, 0.85, 4.05], false, true);
  }
  addMesh(cabin, new THREE.BoxGeometry(7.2, 0.18, 0.18), darkWood, [0, 3.5, 4.05]);

  // A tiny porch roof.
  for (const side of [-1, 1]) {
    const awning = addMesh(cabin, new THREE.BoxGeometry(4.2, 0.13, 2.25), roofMaterial, [side * 1.72, 4.12, 3.85]);
    awning.rotation.z = side * -0.22;
    awning.rotation.x = 0.12;
    const snowAwning = addMesh(
      cabin,
      new THREE.BoxGeometry(4.08, 0.055, 2.13),
      snowCapMaterial,
      [side * 1.72, 4.2, 3.85],
      false,
      false
    );
    snowAwning.rotation.z = side * -0.22;
    snowAwning.rotation.x = 0.12;
    snowMeshes.push(snowAwning);
  }

  // Garland of warm bulbs under the porch beam.
  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc76d,
    emissive: 0xffa940,
    emissiveIntensity: 2.2,
    roughness: 0.4,
  });
  const wireMaterial = new THREE.MeshStandardMaterial({ color: 0x2d2921, roughness: 0.8 });
  for (let i = 0; i < 9; i += 1) {
    const t = i / 8;
    const x = -3.1 + t * 6.2;
    const y = 3.35 - Math.sin(t * Math.PI) * 0.32;
    addMesh(cabin, new THREE.SphereGeometry(0.065, 8, 6), bulbMaterial, [x, y, 4.12], false, false);
    if (i < 8) {
      const nextX = -3.1 + ((i + 1) / 8) * 6.2;
      const nextY = 3.35 - Math.sin(((i + 1) / 8) * Math.PI) * 0.32;
      cylinderBetween(
        cabin,
        new THREE.Vector3(x, y, 4.12),
        new THREE.Vector3(nextX, nextY, 4.12),
        0.009,
        0.009,
        wireMaterial,
        4
      );
    }
  }
  // The two visible glow sprites on the windows share one material.
  const porchLantern = new THREE.Group();
  porchLantern.position.set(-2.7, 3.15, 4.15);
  cabin.add(porchLantern);
  addMesh(porchLantern, new THREE.BoxGeometry(0.42, 0.62, 0.42), metalMaterial, [0, 0, 0], false, false);
  addMesh(porchLantern, new THREE.BoxGeometry(0.28, 0.38, 0.28), bulbMaterial, [0, 0, 0.03], false, false);
  addMesh(porchLantern, new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), metalMaterial, [0, 0.52, 0], false, false);
  const lanternGlow = new THREE.Sprite(windowGlowMaterial);
  lanternGlow.position.set(-2.7, 3.15, 4.4);
  lanternGlow.scale.set(2.2, 2.2, 1);
  cabin.add(lanternGlow);

  // Window and lantern light spilling into the clearing.
  const windowLight = new THREE.PointLight(0xffb35e, 1.4, 14, 2);
  windowLight.position.set(0, 2.4, 3.9);
  cabin.add(windowLight);
  const lanternLight = new THREE.PointLight(0xffb35e, 0.55, 8, 2);
  lanternLight.position.set(-2.7, 3.15, 4.4);
  cabin.add(lanternLight);

  // Log pile
  const logPile = new THREE.Group();
  logPile.position.set(4.45, 0, -9.8);
  cabin.add(logPile);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 4 - row; col += 1) {
      const log = addMesh(
        logPile,
        new THREE.CylinderGeometry(0.16, 0.16, 1.75, 7),
        woodMaterials[(row + col) % 3],
        [0, 0.18 + row * 0.3, -0.7 + col * 0.4]
      );
      log.rotation.x = Math.PI / 2;
    }
  }
  // Little barrel beside the porch
  addMesh(cabin, new THREE.CylinderGeometry(0.38, 0.32, 0.75, 10), woodMaterials[0], [-4.1, 0.38, -9.65]);
  for (const y of [0.22, 0.55]) {
    addMesh(cabin, new THREE.TorusGeometry(0.36, 0.035, 5, 12), metalMaterial, [-4.1, y, -9.65]).rotation.x = Math.PI / 2;
  }

  // Sign by the path.
  const sign = new THREE.Group();
  sign.position.set(-3.55, 0, 7.15);
  sign.rotation.y = 0.18;
  root.add(sign);
  for (const x of [-0.64, 0.64]) {
    addMesh(sign, new THREE.CylinderGeometry(0.055, 0.075, 2.75, 6), darkWood, [x, 1.35, 0]);
  }
  const signBoard = addMesh(
    sign,
    new THREE.BoxGeometry(1.8, 0.92, 0.1),
    new THREE.MeshStandardMaterial({ map: makeSignTexture(), roughness: 0.85 }),
    [0, 2.22, 0]
  );
  signBoard.castShadow = true;
  addMesh(sign, new THREE.BoxGeometry(1.93, 0.06, 0.14), darkWood, [0, 2.7, 0]);
  addMesh(sign, new THREE.BoxGeometry(1.93, 0.06, 0.14), darkWood, [0, 1.74, 0]);

  /* ---------------------------------------------------------------- *
   *  Tiny flower helper (used by the window boxes)
   * ---------------------------------------------------------------- */
  function makeTinyFlower(color, size) {
    if (!tinyFlowerMaterials.has(color)) {
      tinyFlowerMaterials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    }
    const group = new THREE.Group();
    const petalMaterial = tinyFlowerMaterials.get(color);
    for (let i = 0; i < 5; i += 1) {
      const petal = addMesh(
        group,
        new THREE.SphereGeometry(size, 4, 3),
        petalMaterial,
        [Math.cos((i / 5) * Math.PI * 2) * size * 1.5, 0, Math.sin((i / 5) * Math.PI * 2) * size * 1.5],
        false,
        false
      );
      petal.scale.set(1.4, 0.45, 0.9);
      petal.rotation.y = (i / 5) * Math.PI * 2;
    }
    return group;
  }

  /* ---------------------------------------------------------------- *
   *  Trees
   * ---------------------------------------------------------------- */
  const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x5f432e, roughness: 0.95, flatShading: true });
  const barkLightMaterial = new THREE.MeshStandardMaterial({ color: 0x76563b, roughness: 0.95, flatShading: true });
  const foliageMaterials = [
    softMat(0x365c38),
    softMat(0x416b3e),
    softMat(0x2c5034),
    softMat(0x557948),
    softMat(0x3e6338),
  ];
  const broadleafMaterials = [
    softMat(0x557b3d),
    softMat(0x466f37),
    softMat(0x688a47),
    softMat(0x3d6435),
  ];
  const pineGeometry = new THREE.ConeGeometry(1, 1, 9, 1, false);
  const foliageGeometry = new THREE.IcosahedronGeometry(1, 1);

  function makePine(scale = 1, seed = 1) {
    const treeRng = createRng(seed);
    const group = new THREE.Group();
    group.scale.setScalar(scale);
    const trunk = addMesh(
      group,
      new THREE.CylinderGeometry(0.22, 0.52, 5.2, 7),
      barkMaterial,
      [0, 2.6, 0]
    );
    trunk.rotation.y = treeRng() * Math.PI;

    const layers = [
      [3.0, 2.1, 2.9],
      [4.25, 1.7, 2.55],
      [5.35, 1.3, 2.2],
      [6.25, 0.86, 1.8],
    ];
    layers.forEach(([y, radius, height], index) => {
      const material = pick(treeRng, foliageMaterials);
      const foliage = new THREE.Mesh(pineGeometry, material);
      foliage.position.y = y;
      foliage.scale.set(radius, height, radius);
      foliage.rotation.y = treeRng() * Math.PI;
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      group.add(foliage);

      const snow = new THREE.Mesh(pineGeometry, snowCapMaterial);
      snow.position.y = y + height * 0.16;
      snow.scale.set(radius * (1.02 - index * 0.025), height * 0.43, radius * (1.02 - index * 0.025));
      snow.castShadow = false;
      snow.receiveShadow = false;
      snowMeshes.push(snow);
      group.add(snow);
    });

    return group;
  }

  function makeBroadleaf(scale = 1, seed = 2) {
    const treeRng = createRng(seed);
    const group = new THREE.Group();
    group.scale.setScalar(scale);
    addMesh(
      group,
      new THREE.CylinderGeometry(0.26, 0.56, 4.8, 8),
      barkMaterial,
      [0, 2.4, 0]
    );

    const branchEnds = [];
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + treeRng() * 0.9;
      const start = new THREE.Vector3(0, 3.0 + treeRng() * 1.1, 0);
      const end = new THREE.Vector3(
        Math.cos(angle) * range(treeRng, 1.4, 2.3),
        start.y + range(treeRng, 0.7, 1.55),
        Math.sin(angle) * range(treeRng, 1.4, 2.3)
      );
      cylinderBetween(group, start, end, 0.16, 0.065, barkLightMaterial, 5);
      branchEnds.push(end);
    }

    const clusters = [];
    for (const end of branchEnds) clusters.push(end.clone());
    clusters.push(new THREE.Vector3(0, 5.7, 0));
    clusters.push(new THREE.Vector3(0.55, 5.2, 0.2));
    clusters.push(new THREE.Vector3(-0.4, 5.0, -0.3));

    for (const cluster of clusters) {
      const radius = range(treeRng, 1.25, 1.9);
      const foliage = new THREE.Mesh(foliageGeometry, pick(treeRng, broadleafMaterials));
      foliage.position.copy(cluster);
      foliage.scale.set(
        radius * range(treeRng, 0.9, 1.25),
        radius * range(treeRng, 0.72, 1.0),
        radius * range(treeRng, 0.9, 1.2)
      );
      foliage.rotation.set(treeRng() * Math.PI, treeRng() * Math.PI, treeRng() * Math.PI);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      group.add(foliage);

      const snow = new THREE.Mesh(foliageGeometry, snowCapMaterial);
      snow.position.copy(cluster).add(new THREE.Vector3(0, radius * 0.43, 0));
      snow.scale.copy(foliage.scale).multiplyScalar(0.82);
      snow.scale.y *= 0.34;
      snow.castShadow = false;
      snow.receiveShadow = false;
      snowMeshes.push(snow);
      group.add(snow);
    }

    return group;
  }

  function registerTree(group, x, z, canSway = true) {
    group.position.x = x;
    group.position.z = z;
    group.position.y = terrainHeight(x, z) - 0.12;
    group.userData.swayPhase = rng() * Math.PI * 2;
    group.userData.baseX = group.rotation.x;
    group.userData.baseZ = group.rotation.z;
    group.userData.canSway = canSway;
    trees.push(group);
    root.add(group);
    return group;
  }

  // Hero broadleaf with the owl branch.
  const owlTree = makeBroadleaf(1.12, 117);
  const owlBranch = cylinderBetween(
    owlTree,
    new THREE.Vector3(0.45, 4.52, 0.2),
    new THREE.Vector3(4.45, 4.32, 0.45),
    0.2,
    0.08,
    barkLightMaterial,
    6
  );
  owlBranch.castShadow = true;
  for (let i = 0; i < 3; i += 1) {
    const twig = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.07, 1.1, 5),
      barkLightMaterial
    );
    twig.position.set(2.5 + i * 0.55, 4.48 + i * 0.1, 0.35);
    twig.rotation.z = -0.9 - i * 0.15;
    owlTree.add(twig);
  }
  registerTree(owlTree, -9.2, 4.1, false);

  const squirrelTree = makeBroadleaf(1.2, 248);
  squirrelTree.name = 'tree-squirrel';
  const squirrelBranch = cylinderBetween(
    squirrelTree,
    new THREE.Vector3(0.35, 3.8, 0.2),
    new THREE.Vector3(2.8, 4.6, 0.7),
    0.16,
    0.06,
    barkLightMaterial,
    5
  );
  squirrelBranch.rotation.y = -0.2;
  registerTree(squirrelTree, 9.0, 0.8, false);

  // A slender birch-ish tree that frames the right side.
  const framingTree = makeBroadleaf(0.95, 391);
  framingTree.name = 'tree-framing';
  registerTree(framingTree, 11.8, 5.8, false);

  // Generated forest ring.
  let attempts = 0;
  while (trees.length < 30 && attempts < 120) {
    attempts += 1;
    const angle = rng() * Math.PI * 2;
    const radius = range(rng, 16.5, 31);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 2;
    if (Math.hypot(x * 0.8, (z + 4) * 0.7) < 13.2) continue;
    if (z > 11 && Math.abs(x) < 7.5) continue;
    if (Math.abs(x - 9) < 4 && Math.abs(z - 0.8) < 4) continue;
    if (Math.abs(x + 9.2) < 4 && Math.abs(z - 4.1) < 4) continue;
    const tree = rng() > 0.45 ? makePine(range(rng, 0.72, 1.35), 500 + trees.length) : makeBroadleaf(range(rng, 0.72, 1.28), 900 + trees.length);
    registerTree(tree, x, z, true);
  }

  // Far darker tree line. These are cheap, larger silhouettes.
  for (let i = 0; i < 20; i += 1) {
    const angle = (i / 20) * Math.PI * 2 + range(rng, -0.12, 0.12);
    const radius = range(rng, 35, 46);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 2;
    const tree = makePine(range(rng, 1.2, 1.85), 1400 + i);
    tree.position.set(x, terrainHeight(x, z) + 0.1, z);
    tree.rotation.y = rng() * Math.PI;
    tree.userData.canSway = false;
    tree.traverse((child) => {
      if (child.isMesh) child.castShadow = false;
    });
    root.add(tree);
  }

  // A soft ring of distant ridges makes the horizon feel like a valley
  // instead of a cut-off plane.
  const hillColors = [0x58745f, 0x4d6b58, 0x647e68, 0x526f5c, 0x5d7762, 0x496653];
  const hillGeometry = new THREE.SphereGeometry(1, 14, 8);
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2 + 0.24;
    const radius = range(rng, 66, 79);
    const hill = new THREE.Mesh(
      hillGeometry,
      new THREE.MeshStandardMaterial({
        color: hillColors[i % hillColors.length],
        roughness: 1,
        metalness: 0,
        flatShading: true,
      })
    );
    hill.position.set(Math.cos(angle) * radius, range(rng, -5.5, -1.5), Math.sin(angle) * radius - 3);
    hill.scale.set(range(rng, 27, 43), range(rng, 11, 19), range(rng, 24, 38));
    hill.rotation.y = rng() * Math.PI;
    hill.receiveShadow = false;
    hill.castShadow = false;
    root.add(hill);
  }

  // Instanced silhouettes fill the gaps between the hand-placed pines.
  const distantTreeGeometry = new THREE.ConeGeometry(1, 1, 7);
  distantTreeGeometry.translate(0, 0.5, 0);
  const distantTreeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    fog: true,
  });
  const distantTreeCount = 105;
  const distantTrees = new THREE.InstancedMesh(distantTreeGeometry, distantTreeMaterial, distantTreeCount);
  const distantDummy = new THREE.Object3D();
  const distantColor = new THREE.Color();
  for (let i = 0; i < distantTreeCount; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = range(rng, 38, 56);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 2;
    const height = range(rng, 6.5, 12);
    const width = range(rng, 1.9, 3.4);
    distantDummy.position.set(x, terrainHeight(x, z), z);
    distantDummy.rotation.y = rng() * Math.PI;
    distantDummy.scale.set(width, height, width);
    distantDummy.updateMatrix();
    distantTrees.setMatrixAt(i, distantDummy.matrix);
    distantColor.setHSL(0.31 + rng() * 0.045, 0.22 + rng() * 0.12, 0.16 + rng() * 0.07);
    distantTrees.setColorAt(i, distantColor);
  }
  distantTrees.instanceMatrix.needsUpdate = true;
  if (distantTrees.instanceColor) distantTrees.instanceColor.needsUpdate = true;
  distantTrees.castShadow = false;
  distantTrees.receiveShadow = false;
  distantTrees.frustumCulled = false;
  root.add(distantTrees);

  /* ---------------------------------------------------------------- *
   *  Sunflower field
   * ---------------------------------------------------------------- */
  const sunflowerStemMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0,
    flatShading: true,
  });
  const sunflowerPetalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0,
    flatShading: true,
  });
  const sunflowerCenterMaterial = new THREE.MeshStandardMaterial({
    color: 0x38251a,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const seedFaceTexture = makeTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const baseGradient = ctx.createRadialGradient(w * 0.4, h * 0.35, 4, w / 2, h / 2, w * 0.5);
    baseGradient.addColorStop(0, '#6d4a2c');
    baseGradient.addColorStop(0.55, '#53351f');
    baseGradient.addColorStop(1, '#352015');
    ctx.fillStyle = baseGradient;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2);
    ctx.fill();
    const center = w / 2;
    for (let ring = 0; ring < 9; ring += 1) {
      const radius = 10 + ring * 12.2;
      const count = 8 + ring * 6;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + ring * 0.6;
        const x = center + Math.cos(angle) * radius;
        const y = center + Math.sin(angle) * radius;
        ctx.fillStyle = ring % 2 === 0 ? '#a67b4b' : '#79552f';
        ctx.beginPath();
        ctx.ellipse(x, y, 2.2, 3.2, angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(255,202,82,.52)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
    ctx.stroke();
  });
  const seedFaceMaterial = new THREE.MeshStandardMaterial({
    map: seedFaceTexture,
    emissive: 0x3a210f,
    emissiveIntensity: 0.4,
    roughness: 1,
    metalness: 0,
    transparent: true,
  });

  const petalBase = new THREE.SphereGeometry(1, 7, 5);
  const petalGeometry = petalBase.clone();
  petalGeometry.scale(0.13, 0.43, 0.055);
  petalGeometry.translate(0, 0.44, 0);
  const innerPetalGeometry = petalBase.clone();
  innerPetalGeometry.scale(0.1, 0.3, 0.045);
  innerPetalGeometry.translate(0, 0.32, 0);
  const leafBase = new THREE.SphereGeometry(1, 7, 4);
  const stalkPetal = new THREE.Color();

  function buildSunflowerHead() {
    const head = new THREE.Group();
    const petals = [];
    const outerColors = [0xffc928, 0xffd84a, 0xf6b91f, 0xffe066];
    const innerColors = [0xe9a91d, 0xf7c132, 0xd99b17];
    for (let i = 0; i < 14; i += 1) {
      const petal = petalGeometry.clone();
      petal.rotateZ((i / 14) * Math.PI * 2 + rng() * 0.045);
      paintGeometry(petal, new THREE.Color(pick(rng, outerColors)));
      petals.push(petal);
    }
    for (let i = 0; i < 10; i += 1) {
      const petal = innerPetalGeometry.clone();
      petal.rotateZ((i / 10) * Math.PI * 2 + 0.17);
      paintGeometry(petal, new THREE.Color(pick(rng, innerColors)));
      petals.push(petal);
    }
    const petalMesh = new THREE.Mesh(mergeGeometries(petals), sunflowerPetalMaterial);
    petalMesh.castShadow = true;
    petalMesh.receiveShadow = true;
    head.add(petalMesh);

    const center = new THREE.Mesh(new THREE.SphereGeometry(0.325, 12, 8), sunflowerCenterMaterial);
    center.scale.z = 0.45;
    center.position.z = 0.04;
    center.castShadow = true;
    head.add(center);

    const face = new THREE.Mesh(new THREE.CircleGeometry(0.312, 28), seedFaceMaterial);
    face.position.z = 0.155;
    head.add(face);

    return head;
  }

  function makeSunflower(x, z, scale) {
    const flower = new THREE.Group();
    const height = range(rng, 1.35, 2.35) * scale;
    const stemParts = [];
    const stem = new THREE.CylinderGeometry(0.032, 0.055, height, 5);
    stem.translate(0, height / 2, 0);
    stalkPetal.set(0x4e7537);
    paintGeometry(stem, stalkPetal);
    stemParts.push(stem);
    const leafCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < leafCount; i += 1) {
      const leaf = leafBase.clone();
      leaf.scale(0.44, 0.09, 0.18);
      leaf.rotateZ(0.55 + rng() * 0.3);
      leaf.rotateY((i / leafCount) * Math.PI * 2 + rng());
      leaf.translate(rng() > 0.5 ? 0.28 : -0.28, height * (0.32 + i * 0.18), 0);
      paintGeometry(leaf, new THREE.Color(pick(rng, [0x5b843c, 0x476e32, 0x6d9347])));
      stemParts.push(leaf);
    }
    const stemMesh = new THREE.Mesh(mergeGeometries(stemParts), sunflowerStemMaterial);
    stemMesh.castShadow = true;
    stemMesh.receiveShadow = true;
    flower.add(stemMesh);

    const headPivot = new THREE.Group();
    headPivot.position.y = height;
    headPivot.rotation.x = -0.16 + rng() * 0.15;
    headPivot.rotation.y = range(rng, -0.55, 0.55);
    headPivot.rotation.z = range(rng, -0.18, 0.18);
    const head = buildSunflowerHead();
    headPivot.add(head);
    flower.add(headPivot);

    flower.position.set(x, 0, z);
    flower.rotation.y = rng() * Math.PI * 2;
    flower.userData.phase = rng() * Math.PI * 2;
    flower.userData.height = height;
    flower.userData.headPivot = headPivot;
    flower.userData.baseHeadX = headPivot.rotation.x;
    flower.userData.baseHeadY = headPivot.rotation.y;
    flower.userData.scale = scale;
    root.add(flower);
    flowers.push(flower);
    flowerHeads.push({ x, y: height + 0.08, z });
    return flower;
  }

  let flowerAttempts = 0;
  let flowerCount = 0;
  while (flowerCount < 42 && flowerAttempts < 300) {
    flowerAttempts += 1;
    const x = range(rng, -8.6, 8.6);
    const z = range(rng, -3.2, 11.7);
    const pathX = 0.2 * Math.sin((z + 2) * 0.22) + (z > 7 ? 0.6 : 0);
    if (Math.abs(x - pathX) < 1.55) continue;
    if (Math.hypot(x - 4.6, z - 2.1) < 1.1) continue;
    if (Math.hypot(x + 3.1, z - 2.9) < 0.9) continue;
    if (Math.hypot(x + 3.55, z - 7.15) < 1.9) continue;
    if (Math.hypot(x - 8.55, z - 1.45) < 2.6) continue;
    if (z < -1.5 && Math.abs(x) < 4.8) continue;
    makeSunflower(x, z, range(rng, 0.85, 1.22));
    flowerCount += 1;
  }
  // A few deliberately placed, larger flowers near the path for depth.
  makeSunflower(-2.1, 6.8, 1.28);
  makeSunflower(3.3, 8.9, 1.15);
  makeSunflower(-4.8, 4.9, 1.08);

  /* ---------------------------------------------------------------- *
   *  Grass, ferns, wildflowers, rocks and mushrooms
   * ---------------------------------------------------------------- */
  const grassGeometry = (() => {
    const parts = [];
    const bladeCount = 5;
    for (let i = 0; i < bladeCount; i += 1) {
      const angle = (i / bladeCount) * Math.PI * 2 + 0.4;
      const width = 0.05;
      const height = 0.34 + (i % 3) * 0.14;
      const lean = 0.12 + (i % 2) * 0.1;
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const colors = [];
      const dark = new THREE.Color(0x3d622e);
      const light = new THREE.Color(0x88a758);
      for (let segment = 0; segment < 3; segment += 1) {
        const t0 = segment / 3;
        const t1 = (segment + 1) / 3;
        const y0 = height * t0;
        const y1 = height * t1;
        const w0 = width * (1 - t0);
        const w1 = width * (1 - t1);
        const l0 = lean * t0 * t0;
        const l1 = lean * t1 * t1;
        positions.push(
          -w0, y0, l0, w0, y0, l0, -w1, y1, l1,
          w0, y0, l0, w1, y1, l1, -w1, y1, l1
        );
        for (const t of [t0, t0, t1, t0, t1, t1]) {
          const c = dark.clone().lerp(light, t * 0.9 + 0.1);
          colors.push(c.r, c.g, c.b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.computeVertexNormals();
      g.rotateY(angle);
      parts.push(g);
    }
    return mergeGeometries(parts);
  })();

  const grassMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
  });
  grassMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = grassUniforms.uTime;
    shader.uniforms.uWind = grassUniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nuniform float uWind;'
      )
      .replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float bladeHeight = max(position.y, 0.0);
        float phase = instanceMatrix[3].x * 0.55 + instanceMatrix[3].z * 0.78;
        transformed.x += sin(uTime * 1.9 + phase) * bladeHeight * bladeHeight * 0.9 * uWind;
        transformed.z += cos(uTime * 1.45 + phase * 1.4) * bladeHeight * bladeHeight * 0.5 * uWind;
        `
      );
  };

  const grassCount = 900;
  const grassMesh = new THREE.InstancedMesh(grassGeometry, grassMaterial, grassCount);
  const grassDummy = new THREE.Object3D();
  const grassColor = new THREE.Color();
  let grassPlaced = 0;
  let grassTries = 0;
  while (grassPlaced < grassCount && grassTries < grassCount * 8) {
    grassTries += 1;
    const radius = Math.sqrt(rng()) * 23.5;
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 1.5;
    if (z < -6.7 && Math.abs(x) < 6) continue;
    if (Math.hypot(x, z + 12) < 3.8) continue;
    grassDummy.position.set(x, terrainHeight(x, z) + 0.015, z);
    grassDummy.rotation.y = rng() * Math.PI * 2;
    const scale = range(rng, 0.7, 1.8);
    grassDummy.scale.set(scale, scale * range(rng, 0.8, 1.6), scale);
    grassDummy.updateMatrix();
    grassMesh.setMatrixAt(grassPlaced, grassDummy.matrix);
    grassColor.setHSL(0.25 + rng() * 0.05, 0.27 + rng() * 0.2, 0.33 + rng() * 0.13);
    grassMesh.setColorAt(grassPlaced, grassColor);
    grassPlaced += 1;
  }
  grassMesh.count = grassPlaced;
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  grassMesh.receiveShadow = true;
  grassMesh.castShadow = false;
  grassMesh.frustumCulled = false;
  root.add(grassMesh);

  // Ferns
  const fernMaterial = new THREE.MeshStandardMaterial({
    color: 0x496b39,
    roughness: 0.96,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const fernLeafGeometry = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.2, 0.25, 0.25, 0.7, 0.06, 1.2);
    shape.bezierCurveTo(0.02, 1.32, -0.02, 1.32, -0.06, 1.2);
    shape.bezierCurveTo(-0.25, 0.7, -0.2, 0.25, 0, 0);
    return new THREE.ShapeGeometry(shape, 8);
  })();
  function makeFern(x, z, scale) {
    const group = new THREE.Group();
    const parts = [];
    for (let i = 0; i < 8; i += 1) {
      const leaf = fernLeafGeometry.clone();
      leaf.rotateX(-Math.PI * 0.34);
      leaf.rotateY((i / 8) * Math.PI * 2 + rng() * 0.3);
      leaf.translate(0, 0.04, 0);
      parts.push(leaf);
    }
    const fern = new THREE.Mesh(mergeGeometries(parts), fernMaterial);
    fern.scale.setScalar(range(rng, 0.65, 1.15) * scale);
    fern.rotation.y = rng() * Math.PI * 2;
    fern.castShadow = true;
    fern.receiveShadow = true;
    group.add(fern);
    group.position.set(x, terrainHeight(x, z) + 0.03, z);
    root.add(group);
  }
  for (let i = 0; i < 28; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = range(rng, 7, 22);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 3;
    if (z < -7 && Math.abs(x) < 5.5) continue;
    makeFern(x, z, 1);
  }

  // White and blush wildflowers, instanced in two draw calls.
  const wildflowerPetalGeometry = (() => {
    const parts = [];
    for (let i = 0; i < 6; i += 1) {
      const petal = new THREE.SphereGeometry(1, 5, 3);
      petal.scale(0.055, 0.018, 0.105);
      petal.translate(0, 0, 0.1);
      petal.rotateY((i / 6) * Math.PI * 2);
      parts.push(petal);
    }
    return mergeGeometries(parts);
  })();
  const wildflowerCenterGeometry = new THREE.SphereGeometry(0.05, 5, 3);
  const wildflowerPetalMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff7e8,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const wildflowerCenterMaterial = new THREE.MeshStandardMaterial({ color: 0xe8b947, roughness: 0.9 });
  const wildflowerCount = 110;
  const wildflowerPetals = new THREE.InstancedMesh(wildflowerPetalGeometry, wildflowerPetalMaterial, wildflowerCount);
  const wildflowerCenters = new THREE.InstancedMesh(wildflowerCenterGeometry, wildflowerCenterMaterial, wildflowerCount);
  const wildflowerDummy = new THREE.Object3D();
  let wildflowersPlaced = 0;
  let wildflowerTries = 0;
  const wildflowerPalette = [0xfff9ef, 0xffe5ea, 0xf8e7b5, 0xf3d6e0];
  while (wildflowersPlaced < wildflowerCount && wildflowerTries < 900) {
    wildflowerTries += 1;
    const x = range(rng, -11, 11);
    const z = range(rng, -5, 12.5);
    if (Math.abs(x) < 4.7 && z < -5.5) continue;
    if (Math.abs(x) < 0.8 && z > -6) continue;
    if (Math.hypot(x, z + 12) < 4) continue;
    const y = 0.12 + rng() * 0.14;
    wildflowerDummy.position.set(x, y, z);
    wildflowerDummy.rotation.set(range(rng, -0.18, 0.18), rng() * Math.PI * 2, range(rng, -0.18, 0.18));
    const scale = range(rng, 0.75, 1.6);
    wildflowerDummy.scale.setScalar(scale);
    wildflowerDummy.updateMatrix();
    wildflowerPetals.setMatrixAt(wildflowersPlaced, wildflowerDummy.matrix);
    wildflowerPetals.setColorAt(
      wildflowersPlaced,
      new THREE.Color(pick(rng, wildflowerPalette))
    );
    wildflowerDummy.position.y += 0.025;
    wildflowerDummy.scale.setScalar(scale);
    wildflowerDummy.updateMatrix();
    wildflowerCenters.setMatrixAt(wildflowersPlaced, wildflowerDummy.matrix);
    wildflowersPlaced += 1;
  }
  wildflowerPetals.count = wildflowersPlaced;
  wildflowerCenters.count = wildflowersPlaced;
  wildflowerPetals.instanceMatrix.needsUpdate = true;
  wildflowerCenters.instanceMatrix.needsUpdate = true;
  if (wildflowerPetals.instanceColor) wildflowerPetals.instanceColor.needsUpdate = true;
  wildflowerPetals.receiveShadow = true;
  wildflowerCenters.receiveShadow = true;
  wildflowerPetals.frustumCulled = false;
  wildflowerCenters.frustumCulled = false;
  root.add(wildflowerPetals, wildflowerCenters);

  // Rocks
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x7e8078, roughness: 0.98, flatShading: true });
  const rockMaterialDark = new THREE.MeshStandardMaterial({ color: 0x62665f, roughness: 0.98, flatShading: true });
  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 13; i += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = range(rng, 7, 17);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius - 2;
    if (Math.abs(x) < 3.2 && z < -7) continue;
    const rock = new THREE.Mesh(rockGeometry, rng() > 0.4 ? rockMaterial : rockMaterialDark);
    rock.position.set(x, terrainHeight(x, z) + 0.1, z);
    rock.scale.set(range(rng, 0.3, 0.9), range(rng, 0.2, 0.5), range(rng, 0.35, 0.8));
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    root.add(rock);
  }

  // Mushrooms around the cabin and tree roots.
  const mushroomStemMaterial = new THREE.MeshStandardMaterial({ color: 0xe7dfc8, roughness: 0.9 });
  const mushroomCapMaterial = new THREE.MeshStandardMaterial({ color: 0xb5523e, roughness: 0.82, flatShading: true });
  const mushroomSpotMaterial = new THREE.MeshStandardMaterial({ color: 0xf4e9d1, roughness: 0.9 });
  const mushroomSpots = [
    [-4.3, 1.7], [-4.05, 1.95], [3.6, -3.7], [3.9, -3.5],
    [-8.0, 6.1], [6.9, 3.4], [7.5, 4.3], [-2.8, 8.4], [5.4, 10.2],
  ];
  for (const [x, z] of mushroomSpots) {
    const scale = range(rng, 0.65, 1.25);
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    addMesh(group, new THREE.CylinderGeometry(0.055, 0.08, 0.32, 7), mushroomStemMaterial, [0, 0.16, 0]);
    const cap = addMesh(group, new THREE.SphereGeometry(0.23, 9, 6), mushroomCapMaterial, [0, 0.34, 0]);
    cap.scale.set(0.95, 0.62, 0.95);
    for (let i = 0; i < 3; i += 1) {
      const angle = rng() * Math.PI * 2;
      const dot = addMesh(
        group,
        new THREE.SphereGeometry(0.035, 5, 4),
        mushroomSpotMaterial,
        [Math.cos(angle) * 0.11, 0.44, Math.sin(angle) * 0.11],
        false,
        false
      );
      dot.scale.y = 0.35;
    }
    group.scale.setScalar(scale);
    root.add(group);
  }

  /* ---------------------------------------------------------------- *
   *  Small animals
   * ---------------------------------------------------------------- */
  const animalMaterials = {
    owlBrown: softMat(0x73513a),
    owlCream: softMat(0xd9c6a0),
    owlDark: softMat(0x3b2b22),
    owlOrange: softMat(0xcf8e44),
    white: softMat(0xf0e5d2),
    black: new THREE.MeshStandardMaterial({ color: 0x151312, roughness: 0.5 }),
    pink: softMat(0xe6a0a2),
    squirrel: softMat(0xa86535),
    squirrelLight: softMat(0xd9a36d),
    squirrelTail: softMat(0xc27a3e),
    bluebird: softMat(0x4f82b5),
    yellowbird: softMat(0xe1b64b),
    deer: softMat(0x9e6b45),
  };

  function makeEye(parent, x, y, z, scale = 1) {
    const white = addSphere(parent, animalMaterials.white, [0.085 * scale, 0.095 * scale, 0.05 * scale], [x, y, z], 8);
    white.castShadow = false;
    const pupil = addSphere(parent, animalMaterials.black, [0.045 * scale, 0.055 * scale, 0.03 * scale], [x, y, z + 0.035 * scale], 7);
    pupil.castShadow = false;
    pupil.userData.baseScaleY = pupil.scale.y;
    return { white, pupil };
  }

  function createOwl() {
    const owl = new THREE.Group();
    const body = addSphere(owl, animalMaterials.owlBrown, [0.4, 0.55, 0.34], [0, 0, 0], 10);
    body.rotation.x = -0.1;
    addSphere(owl, animalMaterials.owlCream, [0.27, 0.38, 0.18], [0, -0.03, 0.22], 9);
    const head = new THREE.Group();
    head.position.set(0, 0.47, 0.02);
    owl.add(head);
    addSphere(head, animalMaterials.owlBrown, [0.34, 0.32, 0.31], [0, 0, 0], 10);
    addSphere(head, animalMaterials.owlCream, [0.23, 0.18, 0.12], [0, 0.02, 0.25], 9);
    const eyeL = makeEye(head, -0.13, 0.075, 0.24, 1.35);
    const eyeR = makeEye(head, 0.13, 0.075, 0.24, 1.35);
    const beak = addMesh(head, new THREE.ConeGeometry(0.075, 0.18, 5), animalMaterials.owlOrange, [0, -0.035, 0.32], false, false);
    beak.rotation.x = Math.PI / 2;
    for (const x of [-0.19, 0.19]) {
      const tuft = addMesh(head, new THREE.ConeGeometry(0.08, 0.22, 5), animalMaterials.owlBrown, [x, 0.34, 0], false, false);
      tuft.rotation.z = -Math.sign(x) * 0.3;
    }
    const wingL = addSphere(owl, animalMaterials.owlBrown, [0.12, 0.32, 0.23], [-0.34, -0.02, 0], 7);
    wingL.rotation.z = 0.1;
    const wingR = addSphere(owl, animalMaterials.owlBrown, [0.12, 0.32, 0.23], [0.34, -0.02, 0], 7);
    wingR.rotation.z = -0.1;
    for (const x of [-0.14, 0.14]) {
      addMesh(owl, new THREE.ConeGeometry(0.055, 0.17, 5), animalMaterials.owlOrange, [x, -0.53, 0.1], false, false).rotation.x = -0.2;
    }
    const tail = addMesh(owl, new THREE.ConeGeometry(0.18, 0.35, 5), animalMaterials.owlBrown, [0, -0.42, -0.24], false, false);
    tail.rotation.x = 0.45;
    owl.name = 'owl';
    owl.position.set(-4.55, 5.38, 4.55);
    owl.rotation.y = -0.22;
    owl.scale.setScalar(0.92);
    root.add(owl);
    return { group: owl, head, eyeL, eyeR, wings: [wingL, wingR], baseY: owl.position.y };
  }

  function createSquirrel() {
    const squirrel = new THREE.Group();
    const body = addSphere(squirrel, animalMaterials.squirrel, [0.3, 0.35, 0.27], [0, 0, 0], 9);
    body.rotation.x = 0.18;
    addSphere(squirrel, animalMaterials.squirrelLight, [0.21, 0.24, 0.15], [0, -0.03, 0.2], 8);
    const head = new THREE.Group();
    head.position.set(0, 0.4, 0.08);
    squirrel.add(head);
    addSphere(head, animalMaterials.squirrel, [0.25, 0.24, 0.23], [0, 0, 0], 9);
    addSphere(head, animalMaterials.squirrelLight, [0.13, 0.1, 0.13], [0, -0.08, 0.17], 8);
    for (const x of [-0.15, 0.15]) {
      const ear = addMesh(head, new THREE.ConeGeometry(0.07, 0.17, 5), animalMaterials.squirrel, [x, 0.23, 0], false, false);
      ear.rotation.z = -Math.sign(x) * 0.18;
    }
    makeEye(head, -0.09, 0.05, 0.19, 0.72);
    makeEye(head, 0.09, 0.05, 0.19, 0.72);
    addSphere(head, animalMaterials.black, [0.035, 0.028, 0.03], [0, -0.055, 0.235], 6);
    addSphere(squirrel, animalMaterials.squirrel, [0.07, 0.14, 0.08], [-0.18, 0.05, 0.14], 6);
    addSphere(squirrel, animalMaterials.squirrel, [0.07, 0.14, 0.08], [0.18, 0.05, 0.14], 6);
    const tail = new THREE.Group();
    tail.name = 'squirrel-tail';
    tail.position.set(-0.02, 0.04, 0.22);
    tail.scale.set(-1.15, 1.15, 1.15);
    tail.rotation.y = -0.18;
    tail.rotation.z = 0.14;
    tail.userData.baseZ = 0.14;
    squirrel.add(tail);
    const tailParts = [
      [0.1, 0.02, 0, 0.27, 0.29],
      [0.23, 0.2, 0.02, 0.3, 0.32],
      [0.35, 0.4, 0.02, 0.33, 0.35],
      [0.43, 0.61, 0, 0.32, 0.34],
      [0.44, 0.82, -0.02, 0.28, 0.3],
      [0.38, 1.0, 0.02, 0.23, 0.25],
    ];
    for (const [x, y, z, sx, sy] of tailParts) {
      addSphere(tail, animalMaterials.squirrelTail, [sx * 0.55, sy * 0.55, sx * 0.42], [x, y, z], 7);
    }
    const tailTip = addSphere(tail, animalMaterials.squirrelLight, [0.21, 0.22, 0.16], [0.27, 1.16, 0.05], 6);
    tailTip.rotation.x = 0.2;
    squirrel.name = 'squirrel';
    squirrel.position.set(8.5, 2.32, 1.42);
    squirrel.rotation.y = -0.18;
    squirrel.scale.setScalar(1.18);
    root.add(squirrel);
    return { group: squirrel, head, tail, baseY: squirrel.position.y };
  }

  function createBird(colorMaterial, scale = 1) {
    const bird = new THREE.Group();
    const body = addSphere(bird, colorMaterial, [0.17, 0.15, 0.23], [0, 0, 0], 8);
    const head = addSphere(bird, colorMaterial, [0.13, 0.13, 0.13], [0, 0.14, 0.1], 8);
    makeEye(head, -0.055, 0.02, 0.105, 0.55);
    makeEye(head, 0.055, 0.02, 0.105, 0.55);
    const beak = addMesh(bird, new THREE.ConeGeometry(0.035, 0.11, 5), animalMaterials.owlOrange, [0.12, 0.13, 0.19], false, false);
    beak.rotation.z = -Math.PI / 2;
    beak.rotation.y = 0.4;
    addMesh(bird, new THREE.ConeGeometry(0.07, 0.24, 5), colorMaterial, [-0.18, -0.01, -0.03], false, false).rotation.z = Math.PI / 2;
    const wingL = addSphere(bird, colorMaterial, [0.04, 0.06, 0.16], [-0.16, 0.04, 0], 6);
    const wingR = addSphere(bird, colorMaterial, [0.04, 0.06, 0.16], [0.16, 0.04, 0], 6);
    bird.scale.setScalar(scale);
    root.add(bird);
    return { group: bird, head, wings: [wingL, wingR], baseY: 0 };
  }

  function createRabbit() {
    const rabbit = new THREE.Group();
    const fur = softMat(0xd8c7a8);
    const furLight = softMat(0xefe4cc);
    const body = addSphere(rabbit, fur, [0.38, 0.42, 0.34], [0, 0, 0], 10);
    body.rotation.x = -0.12;
    addSphere(rabbit, furLight, [0.24, 0.26, 0.16], [0, -0.03, 0.26], 8);
    const head = new THREE.Group();
    head.position.set(0, 0.44, 0.22);
    rabbit.add(head);
    addSphere(head, fur, [0.25, 0.24, 0.24], [0, 0, 0], 9);
    addSphere(head, furLight, [0.14, 0.12, 0.12], [0, -0.07, 0.18], 8);
    makeEye(head, -0.1, 0.05, 0.2, 0.85);
    makeEye(head, 0.1, 0.05, 0.2, 0.85);
    addSphere(head, animalMaterials.pink, [0.045, 0.035, 0.03], [0, -0.075, 0.28], 6);
    const ears = [];
    for (const x of [-0.11, 0.11]) {
      const ear = new THREE.Group();
      ear.position.set(x, 0.2, 0);
      head.add(ear);
      addMesh(ear, new THREE.CapsuleGeometry(0.06, 0.33, 4, 6), fur, [0, 0.2, 0], false, true).rotation.x = 0.08;
      addMesh(ear, new THREE.CapsuleGeometry(0.03, 0.24, 4, 5), animalMaterials.pink, [0, 0.2, 0.05], false, false).rotation.x = 0.08;
      ear.rotation.z = x > 0 ? -0.12 : 0.12;
      ears.push(ear);
    }
    for (const x of [-0.19, 0.19]) {
      addSphere(rabbit, fur, [0.16, 0.11, 0.24], [x, -0.3, 0.08], 7);
    }
    addSphere(rabbit, furLight, [0.15, 0.15, 0.15], [0, -0.02, -0.37], 7);
    rabbit.name = 'rabbit';
    rabbit.position.set(4.45, 0.03, 2.25);
    rabbit.rotation.y = 0.28;
    rabbit.scale.setScalar(0.92);
    root.add(rabbit);
    return { group: rabbit, head, ears, baseY: rabbit.position.y };
  }

  const owl = createOwl();
  const squirrel = createSquirrel();
  const rabbit = createRabbit();

  const birdBlue = createBird(animalMaterials.bluebird, 1);
  birdBlue.group.name = 'bird-blue';
  birdBlue.group.position.set(-1.75, 7.17, -11.98);
  birdBlue.group.rotation.y = 0.08;
  birdBlue.baseY = birdBlue.group.position.y;

  const birdYellow = createBird(animalMaterials.yellowbird, 0.84);
  birdYellow.group.name = 'bird-yellow';
  birdYellow.group.position.set(1.0, 7.17, -11.98);
  birdYellow.group.rotation.y = -0.12;
  birdYellow.baseY = birdYellow.group.position.y;

  /* ---------------------------------------------------------------- *
   *  Butterflies
   * ---------------------------------------------------------------- */
  const butterflyWingShape = new THREE.Shape();
  butterflyWingShape.moveTo(0, 0);
  butterflyWingShape.bezierCurveTo(0.34, 0.55, 0.95, 0.62, 0.88, 0.12);
  butterflyWingShape.bezierCurveTo(0.78, -0.28, 0.42, -0.4, 0.08, -0.2);
  butterflyWingShape.quadraticCurveTo(0.01, -0.12, 0, 0);
  const butterflyWingGeometry = new THREE.ShapeGeometry(butterflyWingShape, 8);
  butterflyWingGeometry.rotateX(-Math.PI / 2);

  function createButterfly(color, seed) {
    const rngB = createRng(seed);
    const group = new THREE.Group();
    const wingMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      emissive: new THREE.Color(color).multiplyScalar(0.15),
    });
    addSphere(group, animalMaterials.black, [0.045, 0.055, 0.19], [0, 0, 0], 7);
    addSphere(group, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }), [0.04, 0.05, 0.09], [0, 0, 0.2], 6);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.045, 0.02, 0);
      group.add(pivot);
      const wing = new THREE.Mesh(butterflyWingGeometry, wingMaterial);
      wing.scale.x = side;
      pivot.add(wing);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), animalMaterials.black);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(side * 0.48, 0.008, 0.15);
      spot.scale.y = 0.7;
      pivot.add(spot);
    }
    group.scale.setScalar(0.76);
    group.userData.baseScale = 0.76;
    group.userData.flapPhase = rngB() * Math.PI * 2;
    group.userData.flapPivots = group.children.filter((child) => child.isGroup);
    root.add(group);

    const center = new THREE.Vector3(range(rngB, -3.5, 4.5), 0, range(rngB, 0, 8));
    const points = [];
    const pointCount = 7;
    for (let i = 0; i < pointCount; i += 1) {
      const angle = (i / pointCount) * Math.PI * 2;
      const radius = range(rngB, 2.1, 5.3);
      points.push(
        new THREE.Vector3(
          center.x + Math.cos(angle) * radius,
          range(rngB, 1.0, 3.1),
          center.z + Math.sin(angle) * radius * 0.75
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.45);
    butterflies.push({
      group,
      curve,
      speed: range(rngB, 0.018, 0.032),
      offset: rngB(),
      wingMaterials: [wingMaterial],
      flapPhase: group.userData.flapPhase,
      baseScale: group.userData.baseScale,
    });
  }

  const butterflyColors = [0xf2a33b, 0x7eb4dc, 0xf0cf55, 0xe58c8a, 0xc7a6df];
  for (let i = 0; i < 7; i += 1) createButterfly(butterflyColors[i % butterflyColors.length], 3000 + i);

  // Give the first butterfly a low, foreground flight path so there is
  // always a pair of wings to notice among the sunflowers.
  butterflies[0].curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-5.0, 2.5, 6.2),
      new THREE.Vector3(-1.7, 3.3, 9.5),
      new THREE.Vector3(2.5, 2.2, 10.4),
      new THREE.Vector3(5.8, 3.1, 7.7),
      new THREE.Vector3(3.1, 2.8, 4.5),
      new THREE.Vector3(-1.4, 2.1, 4.9),
      new THREE.Vector3(-4.6, 3.2, 4.2),
    ],
    true,
    'catmullrom',
    0.4
  );
  butterflies[0].speed = 0.024;

  /* ---------------------------------------------------------------- *
   *  Bees
   * ---------------------------------------------------------------- */
  const beeYellow = new THREE.MeshStandardMaterial({ color: 0xf0b62e, roughness: 0.6 });
  const beeBlack = new THREE.MeshStandardMaterial({ color: 0x1f1a13, roughness: 0.7 });
  const beeWingMaterial = new THREE.MeshStandardMaterial({
    color: 0xeaf5ff,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  function createBee(index) {
    const rngBee = createRng(5000 + index);
    const bee = new THREE.Group();
    addSphere(bee, beeYellow, [0.105, 0.1, 0.17], [0, 0, 0], 8);
    for (const z of [-0.08, 0.01, 0.1]) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 4, 10), beeBlack);
      stripe.position.z = z;
      stripe.scale.set(1, 0.98, 1);
      bee.add(stripe);
    }
    addSphere(bee, beeBlack, [0.09, 0.09, 0.09], [0, 0.01, 0.18], 8);
    const wings = [];
    for (const side of [-1, 1]) {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.05, 0.11, -0.01);
      bee.add(wingPivot);
      const wing = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), beeWingMaterial);
      wing.rotation.x = -Math.PI / 2;
      wing.position.x = side * 0.15;
      wing.scale.set(0.7, 1.35, 1);
      wingPivot.add(wing);
      wings.push(wingPivot);
    }
    const head = flowerHeads[Math.floor(rngBee() * flowerHeads.length)];
    const orbit = {
      group: bee,
      centerX: head.x,
      centerZ: head.z,
      height: head.y,
      radius: range(rngBee, 0.55, 1.35),
      speed: range(rngBee, 0.9, 1.8) * (rngBee() > 0.5 ? 1 : -1),
      phase: rngBee() * Math.PI * 2,
      wings,
      baseScale: range(rngBee, 0.78, 1.12),
      bobPhase: rngBee() * Math.PI * 2,
    };
    bee.scale.setScalar(orbit.baseScale);
    root.add(bee);
    bees.push(orbit);
  }
  for (let i = 0; i < 10; i += 1) createBee(i);

  /* ---------------------------------------------------------------- *
   *  Chimney smoke
   * ---------------------------------------------------------------- */
  const smokeTexture = makeSmokeTexture();
  const smokeOrigin = new THREE.Vector3(2.25, 8.22, -13.15);
  for (let i = 0; i < 20; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: smokeTexture,
      color: 0xd8d8cf,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const age = i / 20;
    sprite.userData.age = age;
    sprite.userData.speed = 0.62 + rng() * 0.35;
    sprite.userData.phase = rng() * Math.PI * 2;
    sprite.userData.drift = range(rng, -0.16, 0.32);
    sprite.position.copy(smokeOrigin);
    sprite.scale.set(0.7, 0.7, 0.7);
    root.add(sprite);
    smoke.push(sprite);
  }

  /* ---------------------------------------------------------------- *
   *  Floating pollen
   * ---------------------------------------------------------------- */
  const pollenCount = 210;
  const pollenPositions = new Float32Array(pollenCount * 3);
  const pollenSeeds = [];
  for (let i = 0; i < pollenCount; i += 1) {
    const x = range(rng, -11, 11);
    const z = range(rng, -7, 13);
    const y = range(rng, 0.5, 4.3);
    pollenPositions[i * 3] = x;
    pollenPositions[i * 3 + 1] = y;
    pollenPositions[i * 3 + 2] = z;
    pollenSeeds.push({ phase: rng() * Math.PI * 2, speed: range(rng, 0.18, 0.55), x, z });
  }
  const pollenGeometry = new THREE.BufferGeometry();
  pollenGeometry.setAttribute('position', new THREE.BufferAttribute(pollenPositions, 3));
  const pollenMaterial = new THREE.PointsMaterial({
    color: 0xffedb5,
    size: 0.055,
    map: makeSoftCircleTexture(),
    transparent: true,
    opacity: 0.45,
    alphaTest: 0.02,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pollen = new THREE.Points(pollenGeometry, pollenMaterial);
  pollen.frustumCulled = false;
  root.add(pollen);

  /* ---------------------------------------------------------------- *
   *  Animation / weather response
   * ---------------------------------------------------------------- */
  let lastSnowVisible = false;
  let lastWetVisible = false;
  let currentInsectScale = 1;
  for (const mesh of snowMeshes) mesh.visible = false;

  function update(dt, time, weather) {
    const wind = weather.wind;

    // Trees breathe in the wind.
    for (const tree of trees) {
      if (!tree.userData.canSway) continue;
      const sway = Math.sin(time * 0.62 + tree.userData.swayPhase) * 0.007 * wind;
      tree.rotation.z = tree.userData.baseZ + sway;
      tree.rotation.x = tree.userData.baseX + Math.cos(time * 0.48 + tree.userData.swayPhase) * 0.004 * wind;
    }

    // Sunflowers lean and nod. The motion is deliberately slow.
    for (const flower of flowers) {
      const phase = flower.userData.phase;
      flower.rotation.z = Math.sin(time * 1.05 + phase) * 0.035 * wind;
      flower.rotation.x = Math.cos(time * 0.8 + phase * 1.2) * 0.025 * wind;
      const head = flower.userData.headPivot;
      head.rotation.z =
        Math.sin(time * 1.35 + phase) * 0.045 * wind;
      head.rotation.x = flower.userData.baseHeadX + Math.cos(time * 1.1 + phase) * 0.025 * wind;
    }

    grassUniforms.uTime.value = time;
    grassUniforms.uWind.value = wind;

    // Snow cover
    const snowVisible = weather.snowCover > 0.03;
    if (snowVisible !== lastSnowVisible) {
      lastSnowVisible = snowVisible;
      for (const mesh of snowMeshes) mesh.visible = snowVisible;
    }
    snowCapMaterial.opacity = clamp(weather.snowCover * 0.96, 0, 0.96);
    snowGround.visible = snowVisible;
    snowGroundMaterial.opacity = weather.snowCover * 0.68;

    // Rain-wet surfaces
    groundMaterial.roughness = 0.97 - weather.groundWet * 0.38;
    pathMaterial.roughness = 0.96 - weather.groundWet * 0.35;
    const wetVisible = weather.groundWet > 0.05;
    if (wetVisible !== lastWetVisible) {
      lastWetVisible = wetVisible;
      puddles.visible = wetVisible;
    }
    puddleMaterial.opacity = weather.groundWet * 0.42;

    // Windows and lantern glow feel brighter as the weather closes in.
    windowMaterial.emissiveIntensity = 0.35 + weather.windowLight * 2.1;
    bulbMaterial.emissiveIntensity = 0.35 + weather.windowLight * 2.4;
    windowGlowMaterial.opacity = 0.1 + weather.windowLight * 0.26;
    windowLight.intensity = 0.35 + weather.windowLight * 1.8;
    lanternLight.intensity = 0.15 + weather.windowLight * 0.8;

    // Chimney smoke
    const smokeStrength = weather.smoke;
    for (const sprite of smoke) {
      const data = sprite.userData;
      data.age += dt * data.speed * 0.165;
      if (data.age > 1) data.age -= 1;
      const age = data.age;
      sprite.position.x = smokeOrigin.x + data.drift * age * 4.5 + Math.sin(time * 0.4 + data.phase) * 0.16 * age;
      sprite.position.z = smokeOrigin.z + Math.sin(age * 5 + data.phase) * 0.32 + age * 0.25;
      sprite.position.y = smokeOrigin.y + age * 4.8;
      const size = 0.6 + age * 2.15;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = Math.sin(age * Math.PI) * 0.24 * smokeStrength;
      sprite.visible = sprite.material.opacity > 0.003;
    }

    // Pollen drifts through the sunbeams.
    pollenMaterial.opacity = weather.pollen * 0.52;
    pollen.visible = weather.pollen > 0.02;
    if (pollen.visible) {
      const positions = pollenGeometry.attributes.position;
      for (let i = 0; i < pollenCount; i += 1) {
        const seed = pollenSeeds[i];
        const x = seed.x + Math.sin(time * seed.speed + seed.phase) * 0.8;
        const y = 0.55 + ((time * seed.speed * 0.55 + seed.phase * 0.18) % 4.0);
        const z = seed.z + Math.cos(time * seed.speed * 0.7 + seed.phase) * 0.65;
        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;
    }

    // Insects retreat when the weather turns.
    const insectTarget = weather.insect;
    currentInsectScale = currentInsectScale + (insectTarget - currentInsectScale) * (1 - Math.exp(-2.2 * dt));
    const active = currentInsectScale > 0.03;

    for (const butterfly of butterflies) {
      butterfly.group.visible = active;
      if (!active) continue;
      const t = (time * butterfly.speed + butterfly.offset) % 1;
      const point = butterfly.curve.getPointAt(t);
      const tangent = butterfly.curve.getTangentAt(t);
      point.y += Math.sin(time * 1.7 + butterfly.flapPhase) * 0.12;
      butterfly.group.position.copy(point);
      const lookTarget = point.clone().add(tangent);
      butterfly.group.lookAt(lookTarget);
      const flap = Math.sin(time * 12 + butterfly.flapPhase) * 0.9;
      butterfly.group.children
        .filter((child) => child.isGroup)
        .forEach((pivot, index) => {
          pivot.rotation.z = flap * (index === 0 ? 1 : -1);
        });
      butterfly.group.scale.setScalar(butterfly.baseScale * (0.01 + currentInsectScale * 0.99));
    }

    for (const bee of bees) {
      bee.group.visible = active;
      if (!active) continue;
      const angle = time * bee.speed + bee.phase;
      const x = bee.centerX + Math.cos(angle) * bee.radius;
      const z = bee.centerZ + Math.sin(angle) * bee.radius * 0.8;
      const y = bee.height + 0.35 + Math.sin(angle * 2.3 + bee.bobPhase) * 0.18;
      bee.group.position.set(x, y, z);
      const dx = -Math.sin(angle) * bee.radius * bee.speed;
      const dz = Math.cos(angle) * bee.radius * 0.8 * bee.speed;
      bee.group.rotation.y = Math.atan2(dx, dz);
      bee.group.rotation.z = Math.sin(time * 9 + bee.phase) * 0.08;
      const flap = Math.sin(time * 34 + bee.phase) * 0.9;
      bee.wings[0].rotation.z = flap;
      bee.wings[1].rotation.z = -flap;
      bee.group.scale.setScalar(bee.baseScale * (0.01 + currentInsectScale * 0.99));
    }

    // Animals: small, quiet bits of life.
    owl.head.rotation.y = Math.sin(time * 0.42) * 0.38;
    owl.head.rotation.z = Math.sin(time * 0.31 + 1.8) * 0.07;
    owl.group.position.y = owl.baseY + Math.sin(time * 1.1) * 0.018;
    const owlBlink = Math.sin(time * 0.8 + 2.4) > 0.995 ? 0.15 : 1;
    owl.eyeL.pupil.scale.y = owl.eyeL.pupil.userData.baseScaleY * owlBlink;
    owl.eyeR.pupil.scale.y = owl.eyeR.pupil.userData.baseScaleY * owlBlink;
    owl.wings[0].rotation.z = 0.1 + Math.sin(time * 0.7) * 0.025;
    owl.wings[1].rotation.z = -0.1 - Math.sin(time * 0.7) * 0.025;

    squirrel.head.rotation.y = Math.sin(time * 0.55 + 1) * 0.25;
    squirrel.head.rotation.z = Math.sin(time * 0.75) * 0.06;
    squirrel.tail.rotation.z = squirrel.tail.userData.baseZ + Math.sin(time * 1.1 + 0.3) * 0.1;
    squirrel.tail.rotation.x = Math.sin(time * 0.85) * 0.05;
    squirrel.group.position.y = squirrel.baseY + Math.sin(time * 1.7) * 0.012;

    rabbit.head.rotation.y = Math.sin(time * 0.4 + 1.4) * 0.2;
    rabbit.ears[0].rotation.z = 0.12 + Math.sin(time * 2.1) * 0.08 + Math.sin(time * 5.7) * 0.015;
    rabbit.ears[1].rotation.z = -0.12 - Math.sin(time * 2.1 + 1.2) * 0.08;
    const hopWave = Math.max(0, Math.sin(time * 0.9 + 0.7));
    const hop = Math.pow(hopWave, 18);
    rabbit.group.position.y = rabbit.baseY + hop * 0.24;
    rabbit.group.rotation.x = -hop * 0.12;

    for (const bird of [birdBlue, birdYellow]) {
      const bob = Math.sin(time * 2.2 + (bird === birdBlue ? 0 : 1.8));
      bird.group.position.y = bird.baseY + Math.max(0, bob) * 0.04;
      bird.head.rotation.y = Math.sin(time * 0.75 + (bird === birdBlue ? 0.4 : 2.2)) * 0.35;
      const flap = Math.sin(time * 7.5 + (bird === birdBlue ? 0 : 1.1)) > 0.93 ? Math.sin(time * 28) * 0.9 : 0;
      bird.wings[0].rotation.z = flap;
      bird.wings[1].rotation.z = -flap;
    }
  }

  // Bake world matrices once so flower positions are stable for the bees.
  root.updateMatrixWorld(true);

  return {
    root,
    update,
    terrainHeight,
    flowerHeads,
    activity: () => currentInsectScale,
    snowCapMaterial,
  };
}
