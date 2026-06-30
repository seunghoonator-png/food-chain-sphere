const THREE = window.THREE;

const canvas = document.querySelector("#world");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06090d, 0.0048);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
const controls = {
  yaw: -0.55,
  pitch: 0.28,
  distance: 228,
  dragging: false,
  lastX: 0,
  lastY: 0,
};

const WORLD_RADIUS = 72;
const MOVE_SCALE = 0.014;
const MAX_HISTORY = 280;
const HISTORY_INTERVAL = 1.4;
const DAY_LENGTH = 58;
const MAX_PLANTS = 1250;
const TMP_A = new THREE.Vector3();
const TMP_B = new THREE.Vector3();
const TMP_C = new THREE.Vector3();
const TMP_Q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Vector3(0, 0, 0);

const params = {
  simSpeed: 1.4,
  plantSpread: 1,
  foodEnergy: 1,
  predation: 0.78,
  mutationSize: 0.14,
};

const rules = {
  herb: {
    minSpeed: 0.54,
    maxSpeed: 2.05,
    baseSpeed: 1.06,
    speedSpread: 0.22,
    maxEnergy: 132,
    birthEnergy: 54,
    adultAge: 46,
    lifespanMin: 430,
    lifespanMax: 700,
    baseMetabolism: 0.06,
    speedCost: 0.037,
    efficientSpeed: 1.18,
    overSpeedCost: 1.35,
    overSpeedWear: 1.7,
    overSpeedRepro: 10,
    foodValue: 12.8,
    hungerSeek: 88,
    eatDistance: 0.036,
    perception: 0.34,
    fleeDistance: 0.22,
    mateDistance: 0.065,
    matePerception: 0.5,
    birthCost: 22,
    reproBase: 0.66,
    cooldownBase: 22,
    cooldownCost: 118,
  },
  carn: {
    minSpeed: 0.72,
    maxSpeed: 2.7,
    baseSpeed: 1.46,
    speedSpread: 0.28,
    maxEnergy: 198,
    birthEnergy: 82,
    adultAge: 52,
    lifespanMin: 620,
    lifespanMax: 920,
    baseMetabolism: 0.052,
    speedCost: 0.027,
    efficientSpeed: 1.48,
    overSpeedCost: 0.92,
    overSpeedWear: 1.25,
    overSpeedRepro: 8.2,
    foodValue: 52,
    hungerSeek: 145,
    eatDistance: 0.046,
    perception: 0.52,
    mateDistance: 0.074,
    matePerception: 0.54,
    birthCost: 38,
    reproBase: 0.52,
    cooldownBase: 34,
    cooldownCost: 124,
  },
};

const state = {
  plants: [],
  herbs: [],
  carnivores: [],
  nutrientBursts: [],
  history: [],
  time: 0,
  historyClock: 0,
  paused: false,
  stats: {
    herbBirths: 0,
    carnBirths: 0,
    plantBirths: 0,
    eats: 0,
    deaths: 0,
    recentEvents: [],
  },
};

const dom = {
  hud: document.querySelector(".hud"),
  plantCount: document.querySelector("#plantCount"),
  herbCount: document.querySelector("#herbCount"),
  carnCount: document.querySelector("#carnCount"),
  clock: document.querySelector("#clock"),
  cycleState: document.querySelector("#cycleState"),
  eventRate: document.querySelector("#eventRate"),
  herbSpeed: document.querySelector("#herbSpeed"),
  carnSpeed: document.querySelector("#carnSpeed"),
  herbCost: document.querySelector("#herbCost"),
  carnCost: document.querySelector("#carnCost"),
  herbBirths: document.querySelector("#herbBirths"),
  carnBirths: document.querySelector("#carnBirths"),
  pauseBtn: document.querySelector("#pauseBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  uiToggle: document.querySelector("#uiToggle"),
  countChart: document.querySelector("#countChart"),
  traitChart: document.querySelector("#traitChart"),
  speedControl: document.querySelector("#speedControl"),
  speedValue: document.querySelector("#speedValue"),
  plantSpreadControl: document.querySelector("#plantSpreadControl"),
  plantSpreadValue: document.querySelector("#plantSpreadValue"),
  foodEnergyControl: document.querySelector("#foodEnergyControl"),
  foodEnergyValue: document.querySelector("#foodEnergyValue"),
  predationControl: document.querySelector("#predationControl"),
  predationValue: document.querySelector("#predationValue"),
  mutationControl: document.querySelector("#mutationControl"),
  mutationValue: document.querySelector("#mutationValue"),
};

const countCtx = dom.countChart.getContext("2d");
const traitCtx = dom.traitChart.getContext("2d");

const sun = new THREE.DirectionalLight(0xffffff, 2.25);
sun.position.set(110, 140, 88);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe7ff, 0x14311d, 1.4));

const planet = createPlanet();
scene.add(planet);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(WORLD_RADIUS * 1.018, 96, 48),
  new THREE.MeshBasicMaterial({
    color: 0x6ed9ff,
    transparent: true,
    opacity: 0.055,
    side: THREE.BackSide,
  }),
);
scene.add(atmosphere);

const starField = createStars();
scene.add(starField);

const plantMesh = createInstancedMesh(
  new THREE.ConeGeometry(0.72, 2.25, 5),
  new THREE.MeshBasicMaterial({ color: 0x5ff27b }),
  MAX_PLANTS,
);
scene.add(plantMesh);

const herbMesh = createInstancedMesh(
  new THREE.IcosahedronGeometry(1.34, 1),
  new THREE.MeshBasicMaterial({ color: 0xffd15a }),
  360,
);
scene.add(herbMesh);

const carnMesh = createInstancedMesh(
  new THREE.ConeGeometry(1.08, 2.9, 6),
  new THREE.MeshBasicMaterial({ color: 0xff5c77 }),
  180,
);
scene.add(carnMesh);

const burstMesh = createInstancedMesh(
  new THREE.SphereGeometry(0.85, 10, 8),
  new THREE.MeshBasicMaterial({ color: 0x8ae7ff, transparent: true, opacity: 0.58 }),
  160,
);
scene.add(burstMesh);

wireEvents();
resetSimulation();
resize();
requestAnimationFrame(frame);

function createInstancedMesh(geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (material.vertexColors) {
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  }
  mesh.count = 0;
  return mesh;
}

function createPlanet() {
  const texture = new THREE.CanvasTexture(createPlanetTexture());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const geometry = new THREE.SphereGeometry(WORLD_RADIUS, 128, 64);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.92,
    metalness: 0.0,
  });
  return new THREE.Mesh(geometry, material);
}

function createPlanetTexture() {
  const size = 1024;
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = size;
  textureCanvas.height = size / 2;
  const ctx = textureCanvas.getContext("2d");
  const image = ctx.createImageData(size, size / 2);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const u = x / image.width;
      const v = y / image.height;
      const latitude = Math.abs(v - 0.5) * 2;
      const n =
        Math.sin(u * 19.4 + Math.sin(v * 10.1) * 1.8) * 0.34 +
        Math.sin(u * 42.7 + v * 23.2) * 0.18 +
        Math.cos(u * 8.1 - v * 17.8) * 0.26;
      const land = n + (0.38 - latitude * 0.24) > 0.11;
      const idx = (y * image.width + x) * 4;
      const shade = Math.max(0, Math.min(1, 0.58 + n * 0.4 - latitude * 0.12));
      const coast = Math.abs(n + (0.38 - latitude * 0.24) - 0.11) < 0.035;

      if (land) {
        image.data[idx] = coast ? 73 : 42 + shade * 32;
        image.data[idx + 1] = coast ? 137 : 101 + shade * 74;
        image.data[idx + 2] = coast ? 104 : 70 + shade * 44;
      } else {
        image.data[idx] = coast ? 44 : 23 + shade * 28;
        image.data[idx + 1] = coast ? 119 : 74 + shade * 40;
        image.data[idx + 2] = coast ? 132 : 100 + shade * 58;
      }
      image.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#dffdf2";
  ctx.lineWidth = 1;
  for (let x = 0; x < size; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size / 2);
    ctx.stroke();
  }
  for (let y = 0; y < size / 2; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  return textureCanvas;
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < 900; i += 1) {
    const p = randomPointOnSphere().multiplyScalar(360 + Math.random() * 240);
    positions.push(p.x, p.y, p.z);
    color.setHSL(0.53 + Math.random() * 0.13, 0.32, 0.62 + Math.random() * 0.3);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: true, vertexColors: true, opacity: 0.7 }),
  );
}

function resetSimulation() {
  state.plants.length = 0;
  state.herbs.length = 0;
  state.carnivores.length = 0;
  state.nutrientBursts.length = 0;
  state.history.length = 0;
  state.time = 0;
  state.historyClock = 0;
  state.stats.herbBirths = 0;
  state.stats.carnBirths = 0;
  state.stats.plantBirths = 0;
  state.stats.eats = 0;
  state.stats.deaths = 0;
  state.stats.recentEvents.length = 0;

  for (let i = 0; i < 720; i += 1) addPlant(randomPointOnSphere());
  for (let i = 0; i < 128; i += 1) state.herbs.push(createAnimal("herb", randomPointOnSphere()));
  for (let i = 0; i < 26; i += 1) state.carnivores.push(createAnimal("carn", randomPointOnSphere()));

  for (let i = 0; i < 24; i += 1) recordHistory();
  updateHud(true);
}

function createAnimal(kind, pos, inheritedSpeed) {
  const rule = rules[kind];
  const speed =
    inheritedSpeed === undefined
      ? clamp(rule.baseSpeed + gaussian() * rule.speedSpread, rule.minSpeed, rule.maxSpeed)
      : clamp(inheritedSpeed, rule.minSpeed, rule.maxSpeed);
  return {
    kind,
    pos: pos.clone().normalize(),
    dir: randomTangent(pos),
    speed,
    energy: rule.birthEnergy + Math.random() * 34,
    age: Math.random() * rule.adultAge * 1.8,
    lifespan: rule.lifespanMin + Math.random() * (rule.lifespanMax - rule.lifespanMin),
    cooldown: Math.random() * rule.cooldownBase,
    turnBias: (Math.random() - 0.5) * 0.9,
    id: crypto?.randomUUID?.() || `${kind}-${Math.random()}`,
  };
}

function createOffspring(kind, a, b) {
  const rule = rules[kind];
  let speed = (a.speed + b.speed) * 0.5;
  if (Math.random() < 0.1) speed += gaussian() * params.mutationSize + (Math.random() - 0.5) * 0.06;
  speed = clamp(speed, rule.minSpeed, rule.maxSpeed);

  const pos = a.pos.clone().add(b.pos).normalize();
  jitterSurface(pos, 0.026 + Math.random() * 0.02);
  const baby = createAnimal(kind, pos, speed);
  baby.energy = rule.birthEnergy;
  baby.age = 0;
  baby.cooldown = rule.cooldownBase * 1.25;
  return baby;
}

function addPlant(pos) {
  if (state.plants.length >= MAX_PLANTS) return false;
  state.plants.push({ pos: pos.clone().normalize(), seed: Math.random() });
  state.stats.plantBirths += 1;
  return true;
}

function addPlantNear(pos, spread = 0.08) {
  const next = pos.clone().normalize();
  jitterSurface(next, spread * (0.45 + Math.random()));
  return addPlant(next);
}

function spawnDeathPlants(pos, amount, spread) {
  const created = Math.min(amount, Math.max(0, MAX_PLANTS - state.plants.length));
  for (let i = 0; i < created; i += 1) addPlantNear(pos, spread);
  state.nutrientBursts.push({ pos: pos.clone().normalize(), age: 0, life: 2.8 + Math.random() * 1.7 });
}

function simulate(dt) {
  state.time += dt;
  state.historyClock += dt;

  spreadPlants(dt);
  updateAnimals(state.herbs, "herb", dt);
  updateAnimals(state.carnivores, "carn", dt);
  herbEatPlants(dt);
  carnEatHerbs(dt);
  reproduce(state.herbs, "herb", dt);
  reproduce(state.carnivores, "carn", dt);
  updateBursts(dt);

  if (state.historyClock >= HISTORY_INTERVAL) {
    state.historyClock = 0;
    recordHistory();
  }
}

function spreadPlants(dt) {
  if (state.plants.length < 2 || state.plants.length >= MAX_PLANTS) return;
  const room = 1 - state.plants.length / MAX_PLANTS;
  const rate = state.plants.length * 0.021 * params.plantSpread * Math.max(0.04, room);
  let births = Math.floor(rate * dt);
  if (Math.random() < rate * dt - births) births += 1;
  births = Math.min(births, 13);

  for (let i = 0; i < births; i += 1) {
    const parent = state.plants[(Math.random() * state.plants.length) | 0];
    addPlantNear(parent.pos, 0.095);
  }
}

function updateAnimals(animals, kind, dt) {
  const rule = rules[kind];
  const isHerb = kind === "herb";
  const densityStress = getDensityStress(kind);

  for (let i = animals.length - 1; i >= 0; i -= 1) {
    const animal = animals[i];
    animal.age += dt * ageRate(animal, rule);
    animal.cooldown = Math.max(0, animal.cooldown - dt);

    const cost = energyCost(animal, rule) * densityStress;
    animal.energy -= cost * dt;

    if (animal.energy <= 0 || animal.age >= animal.lifespan) {
      const deathPlants = isHerb ? 4 + ((Math.random() * 3) | 0) : 7 + ((Math.random() * 4) | 0);
      spawnDeathPlants(animal.pos, deathPlants, isHerb ? 0.065 : 0.085);
      removeAt(animals, i);
      state.stats.deaths += 1;
      addRecentEvent("death");
      continue;
    }

    const desired = chooseDirection(animal, kind, rule);
    steer(animal, desired, dt, isHerb ? 2.85 : 2.45, rule);
  }
}

function getDensityStress(kind) {
  if (kind === "herb") {
    const foodRatio = state.plants.length / Math.max(1, state.herbs.length);
    return 1 + Math.max(0, 4.8 - foodRatio) * 0.035;
  }
  const preyRatio = state.herbs.length / Math.max(1, state.carnivores.length);
  return 1 + Math.max(0, 3.1 - preyRatio) * 0.06;
}

function chooseDirection(animal, kind, rule) {
  const desired = TMP_A.set(0, 0, 0);

  if (kind === "herb") {
    const predator = nearestByDot(animal.pos, state.carnivores, Math.cos(rule.fleeDistance));
    if (predator) {
      desired.add(tangentAway(animal.pos, predator.pos, TMP_B).multiplyScalar(2.8));
    }

    const hungry = animal.energy < rule.hungerSeek;
    const food = nearestPlant(animal.pos, hungry ? rule.perception : rule.perception * 0.62);
    if (food) {
      desired.add(tangentToward(animal.pos, food.pos, TMP_B).multiplyScalar(hungry ? 1.8 : 0.62));
    }
  } else {
    const prey = nearestByDot(animal.pos, state.herbs, Math.cos(rule.perception));
    if (prey) {
      const hungry = animal.energy < rule.hungerSeek;
      desired.add(tangentToward(animal.pos, prey.pos, TMP_B).multiplyScalar(hungry ? 2.35 : 0.28));
    }
  }

  if (isReady(animal, rule)) {
    const mates = kind === "herb" ? state.herbs : state.carnivores;
    const mate = nearestReadyMate(animal, mates, rule);
    if (mate) desired.add(tangentToward(animal.pos, mate.pos, TMP_B).multiplyScalar(0.92));
  }

  const wander = animal.dir.clone();
  rotateAroundNormal(wander, animal.pos, animal.turnBias * 0.045 + gaussian() * 0.025);
  desired.add(wander.multiplyScalar(0.65));
  return desired;
}

function steer(animal, desired, dt, agility, rule) {
  if (desired.lengthSq() > 0.000001) {
    desired.normalize();
    projectTangent(desired, animal.pos);
    animal.dir.lerp(desired, clamp(dt * agility, 0, 1)).normalize();
  }

  if (Math.random() < dt * 0.18) animal.turnBias = clamp(animal.turnBias + gaussian() * 0.42, -1.7, 1.7);
  rotateAroundNormal(animal.dir, animal.pos, animal.turnBias * 0.014 * dt);
  projectTangent(animal.dir, animal.pos);

  animal.pos.addScaledVector(animal.dir, effectiveSpeed(animal, rule) * MOVE_SCALE * dt).normalize();
  projectTangent(animal.dir, animal.pos);
}

function herbEatPlants(dt) {
  const eatDot = Math.cos(rules.herb.eatDistance);
  for (const herb of state.herbs) {
    const index = nearestPlantIndex(herb.pos, eatDot);
    if (index === -1) continue;
    removeAt(state.plants, index);
    herb.energy = Math.min(rules.herb.maxEnergy, herb.energy + rules.herb.foodValue * params.foodEnergy);
    state.stats.eats += 1;
    addRecentEvent("eat");

    if (Math.random() < 0.22) addPlantNear(herb.pos, 0.13);
  }
}

function carnEatHerbs(dt) {
  if (!state.herbs.length) return;
  const eatDot = Math.cos(rules.carn.eatDistance);

  for (const carn of state.carnivores) {
    const hungerRatio = clamp(1 - carn.energy / rules.carn.maxEnergy, 0, 1);
    if (carn.energy > rules.carn.maxEnergy * 0.82 && Math.random() > 0.04) continue;

    const targetInfo = nearestAgentIndex(carn.pos, state.herbs, eatDot);
    if (targetInfo.index === -1) continue;

    const prey = state.herbs[targetInfo.index];
    const advantage = effectiveSpeed(carn, rules.carn) - effectiveSpeed(prey, rules.herb);
    const preyEnergyFactor = clamp((rules.herb.maxEnergy - prey.energy) / rules.herb.maxEnergy, 0, 0.32);
    const preyPerPredator = state.herbs.length / Math.max(1, state.carnivores.length);
    const lowCompetitionBonus = clamp((preyPerPredator - 3.5) / 16, 0, 0.22);
    const scarcityRefuge = clamp((state.herbs.length - 8) / 58, 0.025, 1);
    const crowdingLimit = clamp(preyPerPredator / 2.4, 0.18, 1);
    const catchChance =
      clamp(0.3 + advantage * 0.22 + preyEnergyFactor + lowCompetitionBonus, 0.07, 0.78) *
      clamp(0.38 + hungerRatio * 1.15, 0.34, 1) *
      scarcityRefuge *
      crowdingLimit;

    if (Math.random() < catchChance * params.predation * dt * 3.7) {
      carn.energy = Math.min(
        rules.carn.maxEnergy,
        carn.energy + (rules.carn.foodValue + prey.energy * 0.18) * params.foodEnergy,
      );
      spawnDeathPlants(prey.pos, 2 + ((Math.random() * 3) | 0), 0.07);
      removeAt(state.herbs, targetInfo.index);
      state.stats.eats += 1;
      state.stats.deaths += 1;
      addRecentEvent("eat");
    }
  }
}

function reproduce(animals, kind, dt) {
  const rule = rules[kind];
  if (animals.length < 2) return;
  const resourceRatio =
    kind === "herb"
      ? state.plants.length / Math.max(1, state.herbs.length)
      : state.herbs.length / Math.max(1, state.carnivores.length);
  const resourceFactor = clamp((resourceRatio - (kind === "herb" ? 2.9 : 1.7)) / (kind === "herb" ? 5.8 : 4.6), 0, 1);
  const maxBirths = Math.max(1, Math.ceil(animals.length * 0.045));
  let births = 0;

  for (let i = 0; i < animals.length && births < maxBirths; i += 1) {
    const a = animals[i];
    if (!isReady(a, rule)) continue;

    for (let j = i + 1; j < animals.length; j += 1) {
      const b = animals[j];
      if (!isReady(b, rule)) continue;
      if (a.pos.dot(b.pos) < Math.cos(rule.mateDistance)) continue;

      const meanCost = (energyCost(a, rule) + energyCost(b, rule)) * 0.5;
      const speedDrag = (reproductionDrag(a, rule) + reproductionDrag(b, rule)) * 0.5;
      const chance = dt * rule.reproBase * resourceFactor * (1 / (1 + meanCost * 5.4 + speedDrag));
      if (Math.random() > chance) break;

      const child = createOffspring(kind, a, b);
      animals.push(child);
      a.energy -= rule.birthCost + meanCost * 8.5 + speedDrag * 4.5;
      b.energy -= rule.birthCost + meanCost * 8.5 + speedDrag * 4.5;
      a.cooldown = rule.cooldownBase + meanCost * rule.cooldownCost + speedDrag * 10;
      b.cooldown = rule.cooldownBase + meanCost * rule.cooldownCost + speedDrag * 10;
      births += 1;
      if (kind === "herb") state.stats.herbBirths += 1;
      else state.stats.carnBirths += 1;
      addRecentEvent("birth");
      break;
    }
  }
}

function isReady(animal, rule) {
  const cost = energyCost(animal, rule);
  const speedDrag = reproductionDrag(animal, rule);
  return (
    animal.age >= rule.adultAge &&
    animal.cooldown <= 0 &&
    animal.energy >= rule.birthEnergy + rule.birthCost + cost * 135 + speedDrag * 18
  );
}

function nearestPlant(pos, range) {
  const minDot = Math.cos(range);
  let best = null;
  let bestDot = minDot;
  for (const plant of state.plants) {
    const dot = pos.dot(plant.pos);
    if (dot > bestDot) {
      bestDot = dot;
      best = plant;
    }
  }
  return best;
}

function nearestPlantIndex(pos, minDot) {
  let bestIndex = -1;
  let bestDot = minDot;
  for (let i = 0; i < state.plants.length; i += 1) {
    const dot = pos.dot(state.plants[i].pos);
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function nearestAgentIndex(pos, agents, minDot) {
  let index = -1;
  let bestDot = minDot;
  for (let i = 0; i < agents.length; i += 1) {
    const dot = pos.dot(agents[i].pos);
    if (dot > bestDot) {
      bestDot = dot;
      index = i;
    }
  }
  return { index, dot: bestDot };
}

function nearestByDot(pos, agents, minDot) {
  let best = null;
  let bestDot = minDot;
  for (const agent of agents) {
    const dot = pos.dot(agent.pos);
    if (dot > bestDot) {
      bestDot = dot;
      best = agent;
    }
  }
  return best;
}

function nearestReadyMate(animal, agents, rule) {
  const minDot = Math.cos(rule.matePerception);
  let best = null;
  let bestDot = minDot;
  for (const other of agents) {
    if (other === animal || !isReady(other, rule)) continue;
    const dot = animal.pos.dot(other.pos);
    if (dot > bestDot) {
      bestDot = dot;
      best = other;
    }
  }
  return best;
}

function energyCost(animal, rule) {
  const over = Math.max(0, animal.speed - rule.efficientSpeed);
  return rule.baseMetabolism + Math.pow(animal.speed, 2.55) * rule.speedCost + Math.pow(over, 2.9) * rule.overSpeedCost;
}

function ageRate(animal, rule) {
  const over = Math.max(0, animal.speed - rule.efficientSpeed);
  return 1 + Math.pow(over, 2.05) * rule.overSpeedWear;
}

function reproductionDrag(animal, rule) {
  const over = Math.max(0, animal.speed - rule.efficientSpeed);
  return Math.pow(over, 2.05) * rule.overSpeedRepro;
}

function effectiveSpeed(animal, rule) {
  const energyRatio = clamp(animal.energy / rule.maxEnergy, 0, 1);
  const fatigue = clamp(0.5 + energyRatio * 0.58, 0.5, 1.02);
  return animal.speed * fatigue;
}

function updateBursts(dt) {
  for (let i = state.nutrientBursts.length - 1; i >= 0; i -= 1) {
    state.nutrientBursts[i].age += dt;
    if (state.nutrientBursts[i].age >= state.nutrientBursts[i].life) removeAt(state.nutrientBursts, i);
  }
}

function addRecentEvent(type) {
  state.stats.recentEvents.push({ time: state.time, type });
  while (state.stats.recentEvents.length && state.stats.recentEvents[0].time < state.time - 60) {
    state.stats.recentEvents.shift();
  }
}

function recordHistory() {
  state.history.push({
    t: state.time,
    plants: state.plants.length,
    herbs: state.herbs.length,
    carnivores: state.carnivores.length,
  });
  while (state.history.length > MAX_HISTORY) state.history.shift();
}

function updateHud(force = false) {
  if (!force && Math.floor(performance.now() / 120) % 2 !== 0) return;

  dom.plantCount.textContent = state.plants.length.toLocaleString("ko-KR");
  dom.herbCount.textContent = state.herbs.length.toLocaleString("ko-KR");
  dom.carnCount.textContent = state.carnivores.length.toLocaleString("ko-KR");

  const days = Math.floor(state.time / DAY_LENGTH);
  const hour = Math.floor(((state.time % DAY_LENGTH) / DAY_LENGTH) * 24);
  const minute = Math.floor((((state.time % DAY_LENGTH) / DAY_LENGTH) * 24 - hour) * 60);
  dom.clock.textContent = `${days}일 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const herbMetrics = summarizeAnimals(state.herbs, rules.herb);
  const carnMetrics = summarizeAnimals(state.carnivores, rules.carn);
  dom.herbSpeed.textContent = herbMetrics.speed.toFixed(2);
  dom.carnSpeed.textContent = carnMetrics.speed.toFixed(2);
  dom.herbCost.textContent = herbMetrics.cost.toFixed(3);
  dom.carnCost.textContent = carnMetrics.cost.toFixed(3);
  dom.herbBirths.textContent = state.stats.herbBirths.toLocaleString("ko-KR");
  dom.carnBirths.textContent = state.stats.carnBirths.toLocaleString("ko-KR");
  dom.eventRate.textContent = `${state.stats.recentEvents.length} 사건/분`;
  dom.cycleState.textContent = cycleLabel();
}

function summarizeAnimals(animals, rule) {
  if (!animals.length) return { speed: 0, cost: 0 };
  let speed = 0;
  let cost = 0;
  for (const animal of animals) {
    speed += animal.speed;
    cost += energyCost(animal, rule);
  }
  return { speed: speed / animals.length, cost: cost / animals.length };
}

function cycleLabel() {
  const plantRatio = state.plants.length / MAX_PLANTS;
  const herbRatio = state.herbs.length / Math.max(1, state.carnivores.length);
  if (!state.herbs.length || !state.carnivores.length) return "멸종 발생";
  if (plantRatio < 0.2) return "식물 부족";
  if (herbRatio < 2.0) return "초식 압박";
  if (herbRatio > 6.8) return "육식 성장권";
  return "순환 유지";
}

function drawCharts() {
  drawCountChart();
  drawTraitChart();
}

function drawCountChart() {
  const canvasEl = dom.countChart;
  const ctx = countCtx;
  const width = canvasEl.width;
  const height = canvasEl.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(5, 10, 13, 0.35)";
  ctx.fillRect(0, 0, width, height);

  const padding = { left: 46, right: 14, top: 14, bottom: 30 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const maxValue = niceMax(
    Math.max(
      10,
      ...state.history.map((h) => Math.max(h.plants, h.herbs, h.carnivores)),
      MAX_PLANTS * 0.45,
    ),
  );

  drawGrid(ctx, padding, plotW, plotH, maxValue, 5);
  drawSeries(ctx, "plants", "#5ff27b", padding, plotW, plotH, maxValue);
  drawSeries(ctx, "herbs", "#ffd15a", padding, plotW, plotH, maxValue);
  drawSeries(ctx, "carnivores", "#ff5c77", padding, plotW, plotH, maxValue);

  const latest = state.history[state.history.length - 1];
  if (latest) {
    drawChartLabel(ctx, `식물 ${latest.plants}`, width - 132, 22, "#5ff27b");
    drawChartLabel(ctx, `초식 ${latest.herbs}`, width - 132, 43, "#ffd15a");
    drawChartLabel(ctx, `육식 ${latest.carnivores}`, width - 132, 64, "#ff5c77");
  }
}

function drawGrid(ctx, padding, plotW, plotH, maxValue, steps) {
  ctx.save();
  ctx.strokeStyle = "rgba(218, 234, 230, 0.13)";
  ctx.fillStyle = "rgba(224, 240, 236, 0.62)";
  ctx.lineWidth = 1;
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= steps; i += 1) {
    const ratio = i / steps;
    const y = padding.top + plotH - plotH * ratio;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + plotW, y);
    ctx.stroke();
    ctx.fillText(Math.round(maxValue * ratio).toString(), padding.left - 8, y);
  }
  ctx.strokeStyle = "rgba(218, 234, 230, 0.28)";
  ctx.strokeRect(padding.left, padding.top, plotW, plotH);
  ctx.restore();
}

function drawSeries(ctx, key, color, padding, plotW, plotH, maxValue) {
  if (state.history.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = key === "plants" ? 2.2 : 2.6;
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;
  ctx.beginPath();
  state.history.forEach((h, i) => {
    const x = padding.left + (i / (MAX_HISTORY - 1)) * plotW;
    const y = padding.top + plotH - (h[key] / maxValue) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawChartLabel(ctx, text, x, y, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawTraitChart() {
  const canvasEl = dom.traitChart;
  const ctx = traitCtx;
  const width = canvasEl.width;
  const height = canvasEl.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(5, 10, 13, 0.35)";
  ctx.fillRect(0, 0, width, height);

  const bins = 12;
  const minSpeed = 0.5;
  const maxSpeed = 2.45;
  const herbBins = histogram(state.herbs, bins, minSpeed, maxSpeed);
  const carnBins = histogram(state.carnivores, bins, minSpeed, maxSpeed);
  const maxValue = niceMax(Math.max(8, ...herbBins, ...carnBins));
  const padding = { left: 42, right: 16, top: 14, bottom: 36 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  drawGrid(ctx, padding, plotW, plotH, maxValue, 4);

  const groupW = plotW / bins;
  for (let i = 0; i < bins; i += 1) {
    const x = padding.left + i * groupW + groupW * 0.18;
    const herbH = (herbBins[i] / maxValue) * plotH;
    const carnH = (carnBins[i] / maxValue) * plotH;
    ctx.fillStyle = "#ffd15a";
    ctx.fillRect(x, padding.top + plotH - herbH, groupW * 0.28, herbH);
    ctx.fillStyle = "#ff5c77";
    ctx.fillRect(x + groupW * 0.34, padding.top + plotH - carnH, groupW * 0.28, carnH);

    if (i % 2 === 0) {
      const speed = minSpeed + (i / bins) * (maxSpeed - minSpeed);
      ctx.fillStyle = "rgba(224, 240, 236, 0.62)";
      ctx.font = "11px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(speed.toFixed(1), padding.left + i * groupW + groupW * 0.5, height - 14);
    }
  }
  drawChartLabel(ctx, "초식", width - 92, 22, "#ffd15a");
  drawChartLabel(ctx, "육식", width - 92, 43, "#ff5c77");
}

function histogram(animals, bins, min, max) {
  const output = new Array(bins).fill(0);
  const span = max - min;
  for (const animal of animals) {
    const i = clamp(Math.floor(((animal.speed - min) / span) * bins), 0, bins - 1);
    output[i] += 1;
  }
  return output;
}

function renderInstances() {
  renderPlants();
  renderAnimals(state.herbs, herbMesh, "herb");
  renderAnimals(state.carnivores, carnMesh, "carn");
  renderBursts();
}

function renderPlants() {
  const color = new THREE.Color();
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const max = Math.min(state.plants.length, plantMesh.instanceMatrix.count);
  plantMesh.count = max;
  for (let i = 0; i < max; i += 1) {
    const plant = state.plants[i];
    const height = 0.72 + (plant.seed % 1) * 0.55;
    scale.setScalar(height);
    composeSurfaceMatrix(matrix, plant.pos, WORLD_RADIUS + 0.8, scale, plant.seed * Math.PI * 2);
    plantMesh.setMatrixAt(i, matrix);
    color.setHSL(0.31 + plant.seed * 0.08, 0.72, 0.48 + plant.seed * 0.14);
    plantMesh.setColorAt(i, color);
  }
  plantMesh.instanceMatrix.needsUpdate = true;
  if (plantMesh.instanceColor) plantMesh.instanceColor.needsUpdate = true;
}

function renderAnimals(animals, mesh, kind) {
  const color = new THREE.Color();
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const max = Math.min(animals.length, mesh.instanceMatrix.count);
  mesh.count = max;
  for (let i = 0; i < max; i += 1) {
    const animal = animals[i];
    const energyRatio = clamp(
      animal.energy / (kind === "herb" ? rules.herb.maxEnergy : rules.carn.maxEnergy),
      0.35,
      1.2,
    );
    const s = kind === "herb" ? 0.88 + energyRatio * 0.18 : 0.95 + energyRatio * 0.16;
    scale.set(s, s, s);
    composeSurfaceMatrix(matrix, animal.pos, WORLD_RADIUS + (kind === "herb" ? 1.55 : 1.95), scale, 0, animal.dir);
    mesh.setMatrixAt(i, matrix);

    const speedT = clamp((animal.speed - rules[kind].minSpeed) / (rules[kind].maxSpeed - rules[kind].minSpeed), 0, 1);
    if (kind === "herb") color.setHSL(0.12 + speedT * 0.08, 0.92, 0.54 + speedT * 0.14);
    else color.setHSL(0.975 - speedT * 0.055, 0.88, 0.55 + speedT * 0.1);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

function renderBursts() {
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const max = Math.min(state.nutrientBursts.length, burstMesh.instanceMatrix.count);
  burstMesh.count = max;
  for (let i = 0; i < max; i += 1) {
    const burst = state.nutrientBursts[i];
    const t = 1 - burst.age / burst.life;
    scale.setScalar(0.8 + (1 - t) * 4.6);
    composeSurfaceMatrix(matrix, burst.pos, WORLD_RADIUS + 2.0, scale, burst.age * 2);
    burstMesh.setMatrixAt(i, matrix);
  }
  burstMesh.instanceMatrix.needsUpdate = true;
}

function composeSurfaceMatrix(matrix, normal, radius, scale, spin = 0, forward) {
  const position = TMP_C.copy(normal).multiplyScalar(radius);
  TMP_Q.setFromUnitVectors(UP, normal);
  if (forward) {
    const tangent = forward.clone().normalize();
    const localForward = new THREE.Vector3(0, 0, 1).applyQuaternion(TMP_Q);
    const signed = Math.atan2(localForward.clone().cross(tangent).dot(normal), localForward.dot(tangent));
    TMP_Q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, signed));
  } else if (spin) {
    TMP_Q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin));
  }
  matrix.compose(position, TMP_Q, scale);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  drawCharts();
}

function updateCamera(dt) {
  if (!controls.dragging && !state.paused) controls.yaw += dt * 0.025;
  controls.pitch = clamp(controls.pitch, -1.18, 1.18);
  const cp = Math.cos(controls.pitch);
  camera.position.set(
    Math.sin(controls.yaw) * cp * controls.distance,
    Math.sin(controls.pitch) * controls.distance,
    Math.cos(controls.yaw) * cp * controls.distance,
  );
  camera.lookAt(ZERO);
}

let last = performance.now();
let chartClock = 0;
function frame(now) {
  const realDt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  const simDt = realDt * params.simSpeed;
  if (!state.paused) simulate(simDt);

  updateCamera(realDt);
  planet.rotation.y += realDt * 0.009;
  atmosphere.rotation.y -= realDt * 0.006;
  starField.rotation.y += realDt * 0.002;
  renderInstances();
  renderer.render(scene, camera);
  updateHud();

  chartClock += realDt;
  if (chartClock > 0.34) {
    chartClock = 0;
    drawCharts();
  }
  requestAnimationFrame(frame);
}

function wireEvents() {
  window.addEventListener("resize", resize);
  dom.uiToggle.addEventListener("click", () => {
    const collapsed = dom.hud.classList.toggle("panels-collapsed");
    dom.uiToggle.textContent = collapsed ? "패널 열기" : "패널 닫기";
    dom.uiToggle.setAttribute("aria-expanded", String(!collapsed));
    requestAnimationFrame(drawCharts);
  });
  dom.pauseBtn.addEventListener("click", () => {
    state.paused = !state.paused;
    dom.pauseBtn.textContent = state.paused ? "▶" : "Ⅱ";
  });
  dom.resetBtn.addEventListener("click", resetSimulation);

  bindSlider(dom.speedControl, dom.speedValue, "simSpeed", (v) => `${v.toFixed(1)}x`);
  bindSlider(dom.plantSpreadControl, dom.plantSpreadValue, "plantSpread", (v) => v.toFixed(2));
  bindSlider(dom.foodEnergyControl, dom.foodEnergyValue, "foodEnergy", (v) => v.toFixed(2));
  bindSlider(dom.predationControl, dom.predationValue, "predation", (v) => v.toFixed(2));
  bindSlider(dom.mutationControl, dom.mutationValue, "mutationSize", (v) => v.toFixed(2));

  canvas.addEventListener("pointerdown", (event) => {
    controls.dragging = true;
    controls.lastX = event.clientX;
    controls.lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!controls.dragging) return;
    const dx = event.clientX - controls.lastX;
    const dy = event.clientY - controls.lastY;
    controls.yaw -= dx * 0.006;
    controls.pitch += dy * 0.005;
    controls.lastX = event.clientX;
    controls.lastY = event.clientY;
  });
  canvas.addEventListener("pointerup", (event) => {
    controls.dragging = false;
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      controls.distance = clamp(controls.distance + event.deltaY * 0.12, 145, 330);
    },
    { passive: false },
  );
}

function bindSlider(input, output, key, format) {
  const sync = () => {
    params[key] = Number(input.value);
    output.textContent = format(params[key]);
  };
  input.addEventListener("input", sync);
  sync();
}

function tangentToward(from, to, out) {
  out.copy(to).addScaledVector(from, -from.dot(to));
  if (out.lengthSq() < 0.000001) return randomTangent(from);
  return out.normalize();
}

function tangentAway(from, threat, out) {
  out.copy(from).addScaledVector(threat, -from.dot(threat));
  if (out.lengthSq() < 0.000001) return randomTangent(from);
  return out.normalize();
}

function projectTangent(vec, normal) {
  vec.addScaledVector(normal, -vec.dot(normal));
  if (vec.lengthSq() < 0.000001) vec.copy(randomTangent(normal));
  return vec.normalize();
}

function randomTangent(normal) {
  const tangent = randomPointOnSphere();
  tangent.addScaledVector(normal, -tangent.dot(normal));
  if (tangent.lengthSq() < 0.000001) tangent.set(normal.y, normal.z, normal.x);
  return tangent.normalize();
}

function rotateAroundNormal(vec, normal, radians) {
  return vec.applyAxisAngle(normal, radians).normalize();
}

function jitterSurface(pos, amount) {
  const tangent = randomTangent(pos).multiplyScalar(amount);
  pos.add(tangent).normalize();
  return pos;
}

function randomPointOnSphere() {
  const z = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(a) * r, z, Math.sin(a) * r);
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function removeAt(array, index) {
  array[index] = array[array.length - 1];
  array.pop();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function niceMax(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

window.ecosystemDebug = {
  state,
  params,
  simulate,
  snapshot() {
    return {
      time: state.time,
      plants: state.plants.length,
      herbs: state.herbs.length,
      carnivores: state.carnivores.length,
      herbBirths: state.stats.herbBirths,
      carnBirths: state.stats.carnBirths,
      herbSpeed: summarizeAnimals(state.herbs, rules.herb).speed,
      carnSpeed: summarizeAnimals(state.carnivores, rules.carn).speed,
    };
  },
};
