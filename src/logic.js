(function exposeLogic(root) {
  const WORLD_LIMIT = 32;
  const WORLD_DIMENSIONS = Object.freeze({ x: 24, y: 16, z: 24 });
  const BLOCK_TYPES = Object.freeze(['grass', 'dirt', 'stone', 'log', 'leaves', 'planks', 'sand', 'brick']);
  const MOVE_DELTAS = Object.freeze({
    forward: [0, 0, -1], backward: [0, 0, 1], left: [-1, 0, 0], right: [1, 0, 0],
  });

  function moveOneBlock(position, direction, grounded) {
    const delta = MOVE_DELTAS[direction];
    if (!delta) return { ...position };
    const next = { x: position.x + delta[0], y: position.y + delta[1], z: position.z + delta[2] };
    if (next.x < 0 || next.z < 0 || next.x >= WORLD_DIMENSIONS.x || next.z >= WORLD_DIMENSIONS.z) return { ...position };
    return next;
  }

  function pressJump(state, nowMs) {
    if (state.grounded) {
      return { accepted: true, state: { grounded: false, jumps: 1, lastJumpAt: nowMs } };
    }
    if (state.jumps === 1 && state.lastJumpAt !== null && nowMs - state.lastJumpAt <= 1000) {
      return { accepted: true, state: { ...state, grounded: false, jumps: 2, lastJumpAt: nowMs } };
    }
    return { accepted: false, state: { ...state } };
  }

  function land(state) {
    return { grounded: true, jumps: 0, lastJumpAt: null };
  }

  function shouldBreakNearby(random = Math.random) {
    return random() < 0.05;
  }

  function withinRadius(origin, target, radius) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dz = target.z - origin.z;
    return dx * dx + dy * dy + dz * dz <= radius * radius;
  }

  function pickupInRange(distance) {
    return distance <= 1;
  }

  function pickupSlot() {
    return 0;
  }

  function structureSpawnAttempt(nowMs, lastAttemptAt, random = Math.random) {
    if (nowMs - lastAttemptAt < 20000) return { attempted: false, spawned: false };
    return { attempted: true, spawned: random() < 0.1 };
  }

  function structureBlockAllowed(blockType) {
    return BLOCK_TYPES.includes(blockType);
  }

  function structurePositionAllowed(position, playerPosition) {
    return position.x !== playerPosition.x || position.y !== playerPosition.y || position.z !== playerPosition.z;
  }

  function fellBelowIsland(playerY, islandBottomY = 0) {
    return playerY < islandBottomY;
  }

  function chooseRespawnPoint(originalSpawn, previousSpawn, hasLand) {
    if (originalSpawn && hasLand(originalSpawn)) return originalSpawn;
    if (previousSpawn && hasLand(previousSpawn)) return previousSpawn;
    return null;
  }

  function advanceMining(progress, blockType, deltaSeconds) {
    const elapsed = Math.max(0, progress.elapsed + Math.max(0, deltaSeconds));
    return {
      elapsed,
      stage: Math.min(9, Math.floor(elapsed)),
      opacity: Math.min(1, 0.32 + elapsed * 0.72),
    };
  }

  function miningComplete(progress, blockType) {
    const duration = blockType === 'dirt' || blockType === 'grass' || blockType === 'leaves'
      ? 0.85
      : blockType === 'stone' ? 2 : 1.25;
    return progress.elapsed >= duration;
  }

  function resetMining() {
    return { elapsed: 0 };
  }

  function createDropState(blockPosition, type) {
    return {
      type,
      size: 0.34,
      position: { x: blockPosition.x + 0.15, y: blockPosition.y + 1.45, z: blockPosition.z + 0.15 },
      velocityY: 1.2,
      settled: false,
      rotationSpeedX: 0.25,
      rotationSpeedY: 0.8,
    };
  }

  function advanceDrop(drop, groundY, deltaSeconds) {
    if (drop.settled) return drop;
    const dt = Math.max(0, deltaSeconds);
    const velocityY = drop.velocityY - 13 * dt;
    const nextY = drop.position.y + velocityY * dt;
    if (Number.isFinite(groundY) && nextY <= groundY + drop.size / 2) {
      return {
        ...drop,
        position: { ...drop.position, y: groundY + 0.18 },
        velocityY: 0,
        settled: true,
      };
    }
    return {
      ...drop,
      position: { ...drop.position, y: nextY },
      velocityY,
    };
  }

  function advancePickup(position, playerPosition, deltaSeconds) {
    const dx = playerPosition.x - position.x;
    const dz = playerPosition.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (!pickupInRange(distance)) return { position: { ...position }, collected: false };
    if (distance < 0.32) return { position: { ...position }, collected: true };
    const travel = Math.min(distance, Math.max(0, deltaSeconds) * 4);
    const ratio = distance > 0 ? travel / distance : 0;
    return {
      position: {
        x: position.x + dx * ratio,
        y: position.y + Math.max(0, deltaSeconds) * 2.2,
        z: position.z + dz * ratio,
      },
      collected: false,
    };
  }

  function addPickupToInventory(inventory, type) {
    let slot = inventory.findIndex((item) => item && item.type === type);
    if (slot < 0) slot = inventory.findIndex((item) => item === null);
    if (slot < 0) return -1;
    if (!inventory[slot]) inventory[slot] = { type, count: 0 };
    inventory[slot].count += 1;
    return slot;
  }

  function placeInventoryBlock(inventory, selectedSlot, position, canPlace, place) {
    const item = inventory[selectedSlot];
    if (!item || item.count < 1 || typeof canPlace !== 'function' || typeof place !== 'function') return false;
    if (!canPlace(position, item.type)) return false;
    if (place(position, item.type) === false) return false;
    item.count -= 1;
    if (item.count === 0) inventory[selectedSlot] = null;
    return true;
  }

  function advancePlacementRepeat(timer, deltaSeconds, buttonHeld, gameActive, interval = 0.3) {
    if (!buttonHeld || !gameActive) return { shouldPlace: false, timer: Math.max(0, timer) };
    const remaining = timer - Math.max(0, deltaSeconds);
    if (remaining > 1e-9) return { shouldPlace: false, timer: remaining };
    return { shouldPlace: true, timer: interval };
  }

  function advanceMovementRepeat(timer, deltaSeconds, keyHeld, gameActive, interval = 0.2) {
    if (!keyHeld || !gameActive) return { shouldMove: false, timer: Math.max(0, timer) };
    const remaining = timer - Math.max(0, deltaSeconds);
    if (remaining > 1e-9) return { shouldMove: false, timer: remaining };
    return { shouldMove: true, timer: interval };
  }

  function easeMovementPosition(current, target, deltaSeconds, speed = 1.5) {
    const alpha = Math.min(1, Math.max(0, deltaSeconds) * speed);
    return {
      x: current.x + (target.x - current.x) * alpha,
      z: current.z + (target.z - current.z) * alpha,
    };
  }

  function nextInstanceCapacity(currentCapacity, requestedCount) {
    let capacity = Math.max(1, currentCapacity || 0);
    while (capacity < requestedCount) capacity *= 2;
    return capacity;
  }

  function updateMouseLook(view, deltaX, deltaY, sensitivity = 0.0022) {
    const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
    const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
    return {
      yaw: view.yaw - safeDeltaX * sensitivity,
      pitch: Math.max(-1.25, Math.min(1.25, view.pitch - safeDeltaY * sensitivity)),
    };
  }

  function renderPixelRatio(width, height, devicePixelRatio = 1, maxPixels = 1280 * 720) {
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const requestedRatio = Math.min(1, Math.max(0.1, devicePixelRatio || 1));
    const budgetRatio = Math.sqrt(maxPixels / (safeWidth * safeHeight));
    return Math.min(requestedRatio, budgetRatio);
  }

  function shouldRenderFrame(nowMs, lastFrameMs, targetFps = 60) {
    return nowMs - lastFrameMs >= 1000 / targetFps;
  }

  const api = {
    WORLD_LIMIT, WORLD_DIMENSIONS, BLOCK_TYPES, moveOneBlock, pressJump, land,
    shouldBreakNearby, withinRadius, pickupInRange, pickupSlot,
    structureSpawnAttempt, structureBlockAllowed, structurePositionAllowed,
    fellBelowIsland, chooseRespawnPoint, advanceMining, miningComplete, resetMining,
    createDropState, advanceDrop, advancePickup, addPickupToInventory, placeInventoryBlock,
    advancePlacementRepeat,
    advanceMovementRepeat, easeMovementPosition, nextInstanceCapacity,
    updateMouseLook, renderPixelRatio, shouldRenderFrame,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    module.exports.WORLD_LIMIT = WORLD_LIMIT;
    module.exports.WORLD_DIMENSIONS = WORLD_DIMENSIONS;
    module.exports.BLOCK_TYPES = BLOCK_TYPES;
    module.exports.moveOneBlock = moveOneBlock;
    module.exports.pressJump = pressJump;
    module.exports.land = land;
    module.exports.shouldBreakNearby = shouldBreakNearby;
    module.exports.withinRadius = withinRadius;
    module.exports.pickupInRange = pickupInRange;
    module.exports.pickupSlot = pickupSlot;
    module.exports.structureSpawnAttempt = structureSpawnAttempt;
    module.exports.structureBlockAllowed = structureBlockAllowed;
    module.exports.structurePositionAllowed = structurePositionAllowed;
    module.exports.fellBelowIsland = fellBelowIsland;
    module.exports.chooseRespawnPoint = chooseRespawnPoint;
    module.exports.advanceMining = advanceMining;
    module.exports.miningComplete = miningComplete;
    module.exports.resetMining = resetMining;
    module.exports.createDropState = createDropState;
    module.exports.advanceDrop = advanceDrop;
    module.exports.advancePickup = advancePickup;
    module.exports.addPickupToInventory = addPickupToInventory;
    module.exports.placeInventoryBlock = placeInventoryBlock;
    module.exports.advancePlacementRepeat = advancePlacementRepeat;
    module.exports.advanceMovementRepeat = advanceMovementRepeat;
    module.exports.easeMovementPosition = easeMovementPosition;
    module.exports.nextInstanceCapacity = nextInstanceCapacity;
    module.exports.updateMouseLook = updateMouseLook;
    module.exports.renderPixelRatio = renderPixelRatio;
    module.exports.shouldRenderFrame = shouldRenderFrame;
  }
  if (root) root.GameLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

