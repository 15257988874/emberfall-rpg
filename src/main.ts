import './style.css'
import { Game } from './game/Game'

/**
 * Mounts the game into the page and releases WebGL resources during navigation.
 *
 * @returns {void} No return value.
 * @sideEffects Creates a live Three.js game instance and browser event listeners.
 */
function bootstrap(): void {
  const container = document.querySelector<HTMLElement>('#app')

  if (!container) {
    throw new Error('Game root #app is unavailable.')
  }

  const game = new Game(container)
  window.addEventListener('beforeunload', () => game.dispose(), { once: true })
}

bootstrap()
