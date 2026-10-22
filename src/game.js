(() => {
  'use strict';

  const L = window.GameLogic;
  const THREEJS = window.THREE;
  const canvas = document.getElementById('viewport');
  const welcome = document.getElementById('welcome');
  const startButton = document.getElementById('start-button');
  const pauseMenu = document.getElementById('pause-menu');
  const resumeButton = document.getElementById('resume-button');
  const hotbar = document.getElementById('hotbar');
  const statusLine = document.getElementById('status');

  if (!THREEJS || !L) {
    statusLine.textContent = 'Three.js could not load. Connect to the internet, then reopen this page.';
    return;
  }

  const renderer = new THREEJS.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(L.renderPixelRatio(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0xbfe0f4, 1);
  renderer.outputColorSpace = THREEJS.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREEJS.Scene();
  scene.background = new THREEJS.Color(0xbfe0f4);
  scene.fog = new THREEJS.Fog(0xbfe0f4, 26, 50);
  const camera = new THREEJS.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.rotation.order = 'YXZ';
  scene.add(new THREEJS.HemisphereLight(0xe6f4ff, 0x6f7259, 1.45));
  const sun = new THREEJS.DirectionalLight(0xfff2d4, 1.25);
  sun.position.set(-8, 18, -7);
  scene.add(sun);

  const textureLoader = new THREEJS.TextureLoader();
  const textureFiles = {
    dirt: 'dirt.png', grass_side: 'grass_side.png', grass_top: 'grass_top.png',
    stone: 'stone.png', log_side: 'log_side.png', log_top: 'log_top.png',
    leaves: 'leaves.png', planks: 'planks.png', sand: 'sand.png', brick: 'brick.png',
  };
  const textures = {};
  for (const [key, file] of Object.entries(textureFiles)) {
    textures[key] = textureLoader.load(window.AssetTextureData?.[file] || `assets/textures/${file}`, undefined, undefined, () => {
      statusLine.textContent = 'A supplied block texture could not be loaded.';
    });
    textures[key].magFilter = THREEJS.NearestFilter;
    textures[key].minFilter = THREEJS.NearestFilter;
    textures[key].generateMipmaps = false;
    textures[key].colorSpace = THREEJS.SRGBColorSpace;
  }
  const crackTextures = Array.from({ length: 10 }, (_, stage) => {
    const texture = textureLoader.load(window.AssetTextureData?.[`destroy_stage_${stage}.png`] || `assets/textures/destroy_stage_${stage}.png`);
    texture.magFilter = THREEJS.NearestFilter;
    texture.minFilter = THREEJS.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  });

  const faceMaterials = {};
  for (const kind of L.BLOCK_TYPES) {
    if (kind === 'grass') {
      faceMaterials[kind] = [
        new THREEJS.MeshLambertMaterial({ map: textures.grass_side }),
        new THREEJS.MeshLambertMaterial({ map: textures.grass_side }),
        new THREEJS.MeshLambertMaterial({ map: textures.grass_top }),
        new THREEJS.MeshLambertMaterial({ map: textures.dirt }),
        new THREEJS.MeshLambertMaterial({ map: textures.grass_side }),
        new THREEJS.MeshLambertMaterial({ map: textures.grass_side }),
      ];
    } else if (kind === 'log') {
      faceMaterials[kind] = [
        new THREEJS.MeshLambertMaterial({ map: textures.log_side }),
        new THREEJS.MeshLambertMaterial({ map: textures.log_side }),
        new THREEJS.MeshLambertMaterial({ map: textures.log_top }),
        new THREEJS.MeshLambertMaterial({ map: textures.log_top }),
        new THREEJS.MeshLambertMaterial({ map: textures.log_side }),
        new THREEJS.MeshLambertMaterial({ map: textures.log_side }),
      ];
    } else {
      faceMaterials[kind] = [new THREEJS.MeshLambertMaterial({ map: textures[kind] })];
    }
  }

  const blocks = new Map();
  const blockGroup = new THREEJS.Group();
  scene.add(blockGroup);
  let blockMeshes = [];
  const blockMeshesByType = new Map();
  const pickups = [];
  const pickupGeometry = new THREEJS.BoxGeometry(0.34, 0.34, 0.34);
  const pickupMaterials = Object.fromEntries(L.BLOCK_TYPES.map((type) => [
    type,
    new THREEJS.MeshLambertMaterial({ map: textures[type === 'grass' ? 'grass_top' : type] || textures.dirt }),
  ]));
  const pickupGroups = new Map();
  const pickupTransform = new THREEJS.Object3D();
  const inventory = Array(9).fill(null);
  let selectedSlot = 0;
  let initialSpawn = null;
  let previousSafeSpawn = null;
  let structureAttemptAt = 0;
  let active = false;
  let paused = false;
  let leftHeld = false;
  let rightHeld = false;
  let placeTimer = 0;
  let moveTimer = 0;
  const heldMoveKeys = new Map();
  let currentBreak = null;
  let crackMesh = null;
  let mouseNdc = new THREEJS.Vector2(0, 0);
  let yaw = 0;
  let pitch = 0;
  let lastMousePosition = null;
  let statusTimer = null;
  let lastFrame = performance.now();
  let visualPlayer = { x: 11, z: 11 };
  let elapsedMs = 0;
  const raycaster = new THREEJS.Raycaster();
  const cubeGeometry = new THREEJS.BoxGeometry(1, 1, 1);

  const player = {
    x: 11, z: 11, feetY: 4, velocityY: 0, grounded: true,
    jumps: 0, lastJumpAt: null,
  };
  const keyOf = (x, y, z) => `${x},${y},${z}`;
  const parseKey = (key) => {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
  };
  const sceneX = (x) => x - L.WORLD_DIMENSIONS.x / 2 + 0.5;
  const sceneZ = (z) => z - L.WORLD_DIMENSIONS.z / 2 + 0.5;
  const toScene = (position) => new THREEJS.Vector3(sceneX(position.x), position.y + 0.5, sceneZ(position.z));

  function putBlock(x, y, z, type) {
    if (!L.structureBlockAllowed(type)) return;
    if (x < 0 || z < 0 || x >= L.WORLD_DIMENSIONS.x || z >= L.WORLD_DIMENSIONS.z || y < 0 || y >= L.WORLD_DIMENSIONS.y) return;
    blocks.set(keyOf(x, y, z), type);
  }

  function surfaceAt(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= L.WORLD_DIMENSIONS.x || iz >= L.WORLD_DIMENSIONS.z) return null;
    for (let y = L.WORLD_DIMENSIONS.y - 1; y >= 0; y--) {
      if (blocks.has(keyOf(ix, y, iz))) return y + 1;
    }
    return null;
  }

  function buildInitialIsland() {
    blocks.clear();
    const cx = Math.floor(L.WORLD_DIMENSIONS.x / 2);
    const cz = Math.floor(L.WORLD_DIMENSIONS.z / 2);
    for (let x = 1; x < L.WORLD_DIMENSIONS.x - 1; x++) {
      for (let z = 1; z < L.WORLD_DIMENSIONS.z - 1; z++) {
        const distance = Math.hypot(x - cx, z - cz);
        if (distance > 9.7) continue;
        const top = distance < 3.5 ? 3 : 2;
        for (let y = 0; y <= top; y++) {
          const type = y === 0 ? 'stone' : y === top ? (distance > 7.5 ? 'sand' : 'grass') : 'dirt';
          putBlock(x, y, z, type);
        }
      }
    }
    const treeSites = [[6, 7], [17, 7], [6, 16], [18, 16]];
    for (const [x, z] of treeSites) {
      const base = surfaceAt(x, z);
      if (base === null) continue;
      for (let y = base; y < base + 3; y++) putBlock(x, y, z, 'log');
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dy = 1; dy <= 3; dy++) {
            if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 2) > 4) continue;
            const leafPos = { x: x + dx, y: base + dy, z: z + dz };
            if (leafPos.x === x && leafPos.z === z && leafPos.y < base + 3) continue;
            putBlock(leafPos.x, leafPos.y, leafPos.z, 'leaves');
          }
        }
      }
    }
    initialSpawn = { x: cx, y: surfaceAt(cx, cz), z: cz };
    previousSafeSpawn = { ...initialSpawn };
    player.x = cx;
    player.z = cz;
    visualPlayer = { x: cx, z: cz };
    player.feetY = initialSpawn.y;
    player.velocityY = 0;
    player.grounded = true;
    player.jumps = 0;
    player.lastJumpAt = null;
    rebuildBlockMeshes();
  }

  function rebuildBlockMeshes() {
    const grouped = new Map(L.BLOCK_TYPES.map((type) => [type, []]));
    for (const [key, type] of blocks) grouped.get(type)?.push(parseKey(key));
    for (const type of L.BLOCK_TYPES) {
      const positions = grouped.get(type);
      let mesh = blockMeshesByType.get(type);
      if (!positions.length && !mesh) continue;
      const capacity = mesh ? mesh.instanceMatrix.array.length / 16 : 0;
      if (!mesh || capacity < positions.length) {
        if (mesh) blockGroup.remove(mesh);
        const newCapacity = L.nextInstanceCapacity(capacity, positions.length);
        mesh = new THREEJS.InstancedMesh(cubeGeometry, faceMaterials[type], newCapacity);
        mesh.boundingSphere = new THREEJS.Sphere(new THREEJS.Vector3(0, 8, 0), 22);
        blockMeshesByType.set(type, mesh);
        blockGroup.add(mesh);
      }
      const matrix = new THREEJS.Matrix4();
      positions.forEach((pos, index) => {
        matrix.makeTranslation(sceneX(pos.x), pos.y + 0.5, sceneZ(pos.z));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.count = positions.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.positions = positions;
      mesh.userData.blockType = type;
    }
    blockMeshes = [...blockMeshesByType.values()];
  }

  function refreshHotbar() {
    hotbar.replaceChildren();
    inventory.forEach((item, index) => {
      const slot = document.createElement('button');
      slot.className = `slot${index === selectedSlot ? ' selected' : ''}`;
      slot.type = 'button';
      slot.setAttribute('aria-label', item ? `${item.type}, ${item.count}` : `Empty slot ${index + 1}`);
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(index + 1);
      slot.append(number);
      if (item) {
        const image = document.createElement('img');
        const imageFile = `${item.type === 'grass' ? 'grass_top' : item.type}.png`;
        image.src = window.AssetTextureData?.[imageFile] || `assets/textures/${imageFile}`;
        image.alt = '';
        slot.append(image);
        const count = document.createElement('span');
        count.className = 'count';
        count.textContent = String(item.count);
        slot.append(count);
      }
      slot.addEventListener('click', () => {
        selectedSlot = index;
        refreshHotbar();
      });
      hotbar.append(slot);
    });
  }

  function addToInventory(type) {
    if (L.addPickupToInventory(inventory, type) < 0) return false;
    refreshHotbar();
    return true;
  }

  function makePickup(position, type) {
    const drop = L.createDropState(position, type);
    pickups.push({ state: drop, type });
  }

  function syncPickupMeshes() {
    for (const type of L.BLOCK_TYPES) {
      const items = pickups.filter((item) => item.type === type);
      let group = pickupGroups.get(type);
      const capacity = group ? group.instanceMatrix.array.length / 16 : 0;
      if (items.length && (!group || capacity < items.length)) {
        if (group) scene.remove(group);
        group = new THREEJS.InstancedMesh(
          pickupGeometry,
          pickupMaterials[type],
          L.nextInstanceCapacity(capacity, items.length),
        );
        group.boundingSphere = new THREEJS.Sphere(new THREEJS.Vector3(0, 8, 0), 22);
        pickupGroups.set(type, group);
        scene.add(group);
      }
      if (!group) continue;
      group.count = items.length;
      group.visible = items.length > 0;
      items.forEach((item, index) => {
        pickupTransform.position.set(
          sceneX(item.state.position.x),
          item.state.position.y,
          sceneZ(item.state.position.z),
        );
        pickupTransform.rotation.set(item.state.rotationX, item.state.rotationY, 0);
        pickupTransform.updateMatrix();
        group.setMatrixAt(index, pickupTransform.matrix);
      });
      group.instanceMatrix.needsUpdate = true;
    }
  }

  function updatePickups(dt) {
    for (let index = pickups.length - 1; index >= 0; index--) {
      const item = pickups[index];
      const distance = Math.hypot(item.state.position.x - player.x, item.state.position.z - player.z);
      const ground = surfaceAt(item.state.position.x, item.state.position.z);
      const pull = L.advancePickup(item.state.position, { x: player.x, y: player.feetY + 1, z: player.z }, dt);
      if (pull.collected && addToInventory(item.type)) {
        pickups.splice(index, 1);
        continue;
      }
      if (L.pickupInRange(distance)) {
        item.state.position = pull.position;
      } else {
        item.state = L.advanceDrop(item.state, ground ?? 0, dt);
      }
      item.state.rotationY = (item.state.rotationY || 0) + dt * item.state.rotationSpeedY;
      item.state.rotationX = (item.state.rotationX || 0) + dt * item.state.rotationSpeedX;
    }
    syncPickupMeshes();
  }

  function createCrackOverlay(position) {
    if (crackMesh) {
      scene.remove(crackMesh);
      crackMesh.geometry.dispose();
      crackMesh.material.dispose();
    }
    const material = new THREEJS.MeshBasicMaterial({
      map: crackTextures[0], transparent: true, opacity: 0.4, depthWrite: false, side: THREEJS.DoubleSide,
    });
    crackMesh = new THREEJS.Mesh(new THREEJS.BoxGeometry(1.014, 1.014, 1.014), material);
    crackMesh.position.copy(toScene(position));
    scene.add(crackMesh);
  }

  function clearCrack() {
    if (crackMesh) {
      scene.remove(crackMesh);
      crackMesh.geometry.dispose();
      crackMesh.material.dispose();
      crackMesh = null;
    }
    currentBreak = null;
  }

  function setBreakStage(progress) {
    if (!crackMesh) return;
    crackMesh.material.map = crackTextures[progress.stage];
    crackMesh.material.opacity = progress.opacity;
    crackMesh.material.needsUpdate = true;
  }

  function getPointerTarget() {
    raycaster.setFromCamera(mouseNdc, camera);
    const hits = raycaster.intersectObjects(blockMeshes, false);
    if (!hits.length || hits[0].distance > 5.5) return null;
    const hit = hits[0];
    const pos = hit.object.userData.positions?.[hit.instanceId];
    if (!pos) return null;
    const normal = hit.face.normal;
    return { position: { ...pos }, type: hit.object.userData.blockType, normal: { x: Math.round(normal.x), y: Math.round(normal.y), z: Math.round(normal.z) } };
  }

  function removeBlockAndDrop(position, type) {
    blocks.delete(keyOf(position.x, position.y, position.z));
    makePickup(position, type);
  }

  function breakTarget(target) {
    const broken = [{ ...target.position, type: target.type }];
    if (L.shouldBreakNearby(Math.random)) {
      for (const [key, type] of blocks) {
        const position = parseKey(key);
        if (key === keyOf(target.position.x, target.position.y, target.position.z)) continue;
        if (L.withinRadius(target.position, position, 5)) broken.push({ ...position, type });
      }
    }
    for (const block of broken) removeBlockAndDrop(block, block.type);
    rebuildBlockMeshes();
    clearCrack();
  }

  function updateMining(dt) {
    if (!leftHeld || !active) {
      if (currentBreak) clearCrack();
      return;
    }
    const target = getPointerTarget();
    if (!target) {
      if (currentBreak) clearCrack();
      return;
    }
    const targetKey = keyOf(target.position.x, target.position.y, target.position.z);
    if (!currentBreak || currentBreak.key !== targetKey) {
      clearCrack();
      currentBreak = { key: targetKey, position: target.position, type: target.type, progress: L.resetMining() };
      createCrackOverlay(target.position);
    }
    currentBreak.progress = L.advanceMining(currentBreak.progress, target.type, dt);
    setBreakStage(currentBreak.progress);
    if (L.miningComplete(currentBreak.progress, target.type)) breakTarget(target);
  }

  function playerOccupies(position) {
    return position.x === Math.floor(player.x) && position.z === Math.floor(player.z)
      && position.y >= Math.floor(player.feetY) && position.y < Math.ceil(player.feetY + 1.7);
  }

  function placeAtPointer() {
    if (!inventory[selectedSlot] || inventory[selectedSlot].count < 1) {
      rightHeld = false;
      showHint('Collect a block before placing. Hold left mouse to break one, then walk close to its drop.');
      return false;
    }
    const hit = getPointerTarget();
    if (!hit) {
      showHint('Aim at a block face before right-clicking to place.');
      return false;
    }
    const destination = {
      x: hit.position.x + hit.normal.x,
      y: hit.position.y + hit.normal.y,
      z: hit.position.z + hit.normal.z,
    };
    const placed = L.placeInventoryBlock(
      inventory,
      selectedSlot,
      destination,
      (position, type) => L.structureBlockAllowed(type)
        && position.x >= 0 && position.z >= 0
        && position.x < L.WORLD_DIMENSIONS.x && position.z < L.WORLD_DIMENSIONS.z
        && position.y >= 0 && position.y < L.WORLD_DIMENSIONS.y
        && !playerOccupies(position)
        && !blocks.has(keyOf(position.x, position.y, position.z)),
      (position, type) => {
        putBlock(position.x, position.y, position.z, type);
        return blocks.has(keyOf(position.x, position.y, position.z));
      },
    );
    if (!placed) return false;
    refreshHotbar();
    rebuildBlockMeshes();
    return true;
  }

  function addStructure() {
    const candidates = [];
    for (let x = 2; x < L.WORLD_DIMENSIONS.x - 4; x++) {
      for (let z = 2; z < L.WORLD_DIMENSIONS.z - 4; z++) {
        const ground = surfaceAt(x, z);
        if (ground === null || Math.hypot(x - player.x, z - player.z) < 5) continue;
        candidates.push({ x, y: ground, z });
      }
    }
    if (!candidates.length) return;
    const origin = candidates[Math.floor(Math.random() * candidates.length)];
    const types = L.BLOCK_TYPES;
    const choose = () => types[Math.floor(Math.random() * types.length)];
    const structure = [];
    const baseType = choose();
    for (let dx = 0; dx < 3; dx++) {
      for (let dz = 0; dz < 3; dz++) structure.push({ x: origin.x + dx, y: origin.y, z: origin.z + dz, type: baseType });
    }
    for (let dy = 1; dy <= 2; dy++) {
      for (const [dx, dz] of [[0, 0], [0, 2], [2, 0], [2, 2]]) structure.push({ x: origin.x + dx, y: origin.y + dy, z: origin.z + dz, type: choose() });
    }
    const roofType = choose();
    for (let dx = 0; dx < 3; dx++) {
      for (let dz = 0; dz < 3; dz++) structure.push({ x: origin.x + dx, y: origin.y + 3, z: origin.z + dz, type: roofType });
    }
    for (const block of structure) {
      if (playerOccupies(block)) continue;
      putBlock(block.x, block.y, block.z, block.type);
    }
    rebuildBlockMeshes();
    statusLine.textContent = 'A structure appeared on the island.';
    window.setTimeout(() => { statusLine.textContent = ''; }, 1800);
  }

  function isLand(position) {
    return surfaceAt(position.x, position.z) !== null;
  }

  function respawnPlayer() {
    let target = L.chooseRespawnPoint(initialSpawn, previousSafeSpawn, isLand);
    if (!target) {
      buildInitialIsland();
      target = initialSpawn;
    }
    player.x = target.x;
    player.z = target.z;
    player.feetY = surfaceAt(target.x, target.z) ?? target.y;
    visualPlayer = { x: player.x, z: player.z };
    player.velocityY = 0;
    player.grounded = true;
    const reset = L.land(player);
    player.jumps = reset.jumps;
    player.lastJumpAt = reset.lastJumpAt;
    previousSafeSpawn = { x: player.x, y: player.feetY, z: player.z };
    statusLine.textContent = 'Respawned on land.';
    window.setTimeout(() => { statusLine.textContent = ''; }, 1400);
  }

  function targetDirection(localDirection) {
    const forward = { x: Math.round(-Math.sin(yaw)), z: Math.round(-Math.cos(yaw)) };
    const right = { x: Math.round(Math.cos(yaw)), z: Math.round(-Math.sin(yaw)) };
    if (localDirection === 'forward') return forward;
    if (localDirection === 'backward') return { x: -forward.x, z: -forward.z };
    if (localDirection === 'right') return right;
    return { x: -right.x, z: -right.z };
  }

  function canOccupyCell(x, z, feetY) {
    if (x < 0 || z < 0 || x >= L.WORLD_DIMENSIONS.x || z >= L.WORLD_DIMENSIONS.z) return false;
    for (let y = Math.floor(feetY + 0.05); y < Math.ceil(feetY + 1.75); y++) {
      if (blocks.has(keyOf(x, y, z))) return false;
    }
    return true;
  }

  function movePlayer(direction) {
    const vector = targetDirection(direction);
    const target = { x: player.x + vector.x, y: player.feetY, z: player.z + vector.z };
    const x = Math.floor(target.x);
    const z = Math.floor(target.z);
    const ground = surfaceAt(x, z);
    if (player.grounded && ground !== null) {
      if (ground > player.feetY + 1.01 || !canOccupyCell(x, z, ground)) return;
      player.x = target.x;
      player.z = target.z;
      player.feetY = ground;
      previousSafeSpawn = { x: player.x, y: player.feetY, z: player.z };
      return;
    }
    if (!canOccupyCell(x, z, player.feetY)) return;
    player.x = target.x;
    player.z = target.z;
    if (ground === null) player.grounded = false;
  }

  function jump(nowMs) {
    const result = L.pressJump(player, nowMs);
    if (!result.accepted) return;
    player.grounded = result.state.grounded;
    player.jumps = result.state.jumps;
    player.lastJumpAt = result.state.lastJumpAt;
    player.velocityY = 6.2;
  }

  function updatePlayer(dt, nowMs) {
    if (!player.grounded) {
      const oldY = player.feetY;
      player.velocityY -= 18 * dt;
      player.feetY += player.velocityY * dt;
      const ground = surfaceAt(player.x, player.z);
      if (ground !== null && oldY >= ground && player.feetY <= ground) {
        player.feetY = ground;
        player.velocityY = 0;
        player.grounded = true;
        const reset = L.land(player);
        player.jumps = reset.jumps;
        player.lastJumpAt = reset.lastJumpAt;
        previousSafeSpawn = { x: player.x, y: player.feetY, z: player.z };
      }
    }
    if (L.fellBelowIsland(player.feetY, 0)) respawnPlayer();
    visualPlayer = L.easeMovementPosition(visualPlayer, player, dt, 8);
    camera.position.set(sceneX(visualPlayer.x), player.feetY + 1.62, sceneZ(visualPlayer.z));
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
  }

  function handleStructureTimer() {
    const decision = L.structureSpawnAttempt(elapsedMs, structureAttemptAt, Math.random);
    if (!decision.attempted) return;
    structureAttemptAt = elapsedMs;
    if (decision.spawned) addStructure();
  }

  function render(now) {
    if (!L.shouldRenderFrame(now, lastFrame)) return;
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (active) {
      elapsedMs += dt * 1000;
      updatePlayer(dt, now);
      const heldKey = [...heldMoveKeys.keys()].pop();
      const movement = L.advanceMovementRepeat(moveTimer, dt, Boolean(heldKey), active);
      moveTimer = movement.timer;
      if (movement.shouldMove) movePlayer(heldMoveKeys.get(heldKey));
      updatePickups(dt);
      updateMining(dt);
      const repeatPlacement = L.advancePlacementRepeat(placeTimer, dt, rightHeld, active);
      placeTimer = repeatPlacement.timer;
      if (repeatPlacement.shouldPlace) placeAtPointer();
      handleStructureTimer();
    }
    renderer.render(scene, camera);
  }

  function beginPlay() {
    active = true;
    paused = false;
    lastMousePosition = null;
    welcome.classList.add('hidden');
    pauseMenu.classList.add('hidden');
    requestMouseLock();
    focusCanvas();
  }

  function showHint(message) {
    statusLine.textContent = message;
    if (statusTimer !== null) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      statusLine.textContent = '';
      statusTimer = null;
    }, 4500);
  }

  function showMouseFallback() {
    showHint('Mouse lock is unavailable. WASD still works; move the cursor over the game to look and press Escape to pause.');
  }

  function requestMouseLock() {
    if (!canvas.requestPointerLock) {
      showMouseFallback();
      return;
    }
    try {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(showMouseFallback);
    } catch {
      showMouseFallback();
    }
  }

  function focusCanvas() {
    canvas.focus({ preventScroll: true });
  }

  function pauseGame() {
    if (!active) return;
    active = false;
    paused = true;
    heldMoveKeys.clear();
    moveTimer = 0;
    leftHeld = false;
    rightHeld = false;
    clearCrack();
    pauseMenu.classList.remove('hidden');
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  }

  function resumeGame() {
    if (!paused) return;
    paused = false;
    active = true;
    pauseMenu.classList.add('hidden');
    lastMousePosition = null;
    requestMouseLock();
    focusCanvas();
  }

  startButton.addEventListener('click', beginPlay);
  resumeButton.addEventListener('click', resumeGame);
  document.addEventListener('pointerlockchange', () => {
    lastMousePosition = null;
  });
  document.addEventListener('pointerlockerror', showMouseFallback);
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === canvas) {
      const view = L.updateMouseLook({ yaw, pitch }, event.movementX, event.movementY);
      yaw = view.yaw;
      pitch = view.pitch;
      mouseNdc.set(0, 0);
      lastMousePosition = null;
    } else if (active) {
      const deltaX = lastMousePosition ? event.clientX - lastMousePosition.x : event.movementX;
      const deltaY = lastMousePosition ? event.clientY - lastMousePosition.y : event.movementY;
      const view = L.updateMouseLook({ yaw, pitch }, deltaX, deltaY);
      yaw = view.yaw;
      pitch = view.pitch;
      lastMousePosition = { x: event.clientX, y: event.clientY };
      mouseNdc.set(0, 0);
    } else if (event.target === canvas) {
      mouseNdc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') {
      event.preventDefault();
      if (active) pauseGame();
      else if (paused) resumeGame();
      return;
    }
    if (!active || event.repeat) return;
    if (event.code === 'Space') {
      event.preventDefault();
      jump(performance.now());
      return;
    }
    const moves = { KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right' };
    if (moves[event.code]) {
      event.preventDefault();
      heldMoveKeys.delete(event.code);
      heldMoveKeys.set(event.code, moves[event.code]);
      movePlayer(moves[event.code]);
      moveTimer = 0.2;
      return;
    }
    if (/^Digit[1-9]$/.test(event.code)) {
      selectedSlot = Number(event.code.slice(-1)) - 1;
      refreshHotbar();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (!heldMoveKeys.has(event.code)) return;
    heldMoveKeys.delete(event.code);
    if (!heldMoveKeys.size) moveTimer = 0;
  });
  window.addEventListener('blur', () => {
    heldMoveKeys.clear();
    moveTimer = 0;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      leftHeld = true;
      if (active) showHint('Keep holding left mouse on the block until it breaks. A quick click cancels.');
      if (document.pointerLockElement !== canvas) mouseNdc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    } else if (event.button === 2) {
      event.preventDefault();
      rightHeld = true;
      if (document.pointerLockElement !== canvas) mouseNdc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
      placeAtPointer();
      placeTimer = 0.3;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) {
      leftHeld = false;
      clearCrack();
    }
    if (event.button === 2) rightHeld = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  hotbar.addEventListener('wheel', (event) => {
    event.preventDefault();
    selectedSlot = (selectedSlot + (event.deltaY > 0 ? 1 : 8)) % 9;
    refreshHotbar();
  }, { passive: false });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(L.renderPixelRatio(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  });

  buildInitialIsland();
  refreshHotbar();
  renderer.setAnimationLoop(render);
})();


