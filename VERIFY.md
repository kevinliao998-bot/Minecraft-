# VERIFY.md

## STEP 0 The island
- [ ] AI added: WASD moves forward, left, backward, and right; Space jumps.
- [ ] AI added: Hold the left mouse button to break a block; cracks appear and advance while held.
- [ ] AI added: Broken blocks drop a matching pickup; walking over it adds one to its inventory slot.
- [ ] AI added: Right-click places a block from the selected slot and uses one item; holding right-click can place blocks consecutively.
- [ ] AI added: Breaking a block has a chance to break nearby blocks too.
- [ ] AI added: No monsters or crafting.
- [ ] AI added: Fixed world, at most 32 × 32 × 32 blocks; no endless world or multiplayer.
- [ ] AI added: Static HTML, CSS, and JavaScript site using Three.js; no server, accounts, or game engine.
- [ ] AI added: Aim for at least 30 frames per second full screen on the school's older integrated-graphics computers, or CPU-only systems.
- [ ] AI added: Use only textures from the supplied asset pack, including its block-breaking cracks.
- [ ] AI added: Double jump is allowed, but the player cannot jump more than twice before landing; repeated double jumps are allowed.
- [ ] AI added: Random structures may spawn and must use only blocks included in the supplied asset pack.

## Batch 1: break → drop → pick up → place (the teacher's tests)

### STEP 1 Break a block
- [ ] Hold the left button on dirt → cracks appear and grow; the block is gone in under 1 second
- [ ] Click the left button once → the block is still there (must not happen: gone after one click)
- [ ] Let go of the button halfway → the cracks disappear; breaking starts over next time
- [ ] Break stone → it takes longer than dirt, about 2 seconds

### STEP 2 It drops
- [ ] When the block is gone → a small block of the same kind pops out and slowly spins
- [ ] The small block lands and stays on the ground (must not happen: floating in the air, falling through the ground)

### STEP 3 Pick it up
- [ ] Walk next to the small block → it flies to you and that slot's number goes up by 1
- [ ] Stand 3 blocks away → it is not picked up (must not happen)

### STEP 4 Place it
- [ ] Choose a slot with a number and right-click the ground → one block is placed and the number goes down by 1
- [ ] The slot's number is 0 → right-click places nothing (must not happen)
- [ ] The whole chain: break one → pick it up → place it → the number is back where it started

## Batch 2: my idea (my own tests)

### STEP 5 (your idea)
- [ ] holding right click → place multiple blocks consecutively
- [ ] pressing space 2 times → double jump
- [ ] no jumping more than 2 times but can do multiple double jumps
- [ ] random structures spawn
- [ ] structures can only be made with the blocks in the zip.
