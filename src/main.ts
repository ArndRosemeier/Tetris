import { APP_VERSION } from './version';

/**
 * The shell bootstrap: mount point today, the game surface as slices land.
 * Anything that draws belongs behind a seam under `src/` — see docs/ARCHITECTURE.md.
 */
function bootstrap(): void {
  const container = document.querySelector<HTMLDivElement>('#game-container');
  if (!container) {
    throw new Error('#game-container is missing from index.html — the app cannot mount');
  }

  container.dataset['appVersion'] = APP_VERSION;
  container.textContent = `Tetris ${APP_VERSION}`;
}

bootstrap();
