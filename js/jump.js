export function advanceJump(state, dt) {
  if (!state.isJumping) return;
  const step = Math.min(Math.max(dt, 0), 0.05);
  state.jumpHeight += state.jumpVelocity * step - 0.5 * 20 * step * step;
  state.jumpVelocity -= 20 * step;
  if (state.jumpHeight <= 0) {
    state.jumpHeight = 0;
    state.jumpVelocity = 0;
    state.isJumping = false;
  }
}
