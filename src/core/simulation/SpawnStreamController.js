export class SpawnStreamController {
    constructor(config, beanManager, getCanvasSize, isMakeBeanActive) {
        this.config = config;
        this.beanManager = beanManager;
        this.getCanvasSize = getCanvasSize;
        this.isMakeBeanActive = isMakeBeanActive;
    }

    start(state, event) {
        if (event && event.preventDefault) event.preventDefault();
        if (state.spawnTimer !== null) return;
        const { width, height } = this.getCanvasSize();
        this.beanManager.createBean(width, height);
        state.spawnStartedAt = performance.now();
        this.schedule(state);
    }

    stop(state) {
        if (state.spawnTimer === null) return;
        window.clearTimeout(state.spawnTimer);
        state.spawnTimer = null;
        state.spawnStartedAt = 0;
    }

    schedule(state) {
        const elapsedSec = Math.max(0, (performance.now() - state.spawnStartedAt) / 1000);
        const acceleration = this.config.spawn.accelerationPerSecond ?? 0;
        const minInterval = this.config.spawn.minIntervalMs ?? this.config.spawn.intervalMs;
        const nextInterval = Math.max(
            minInterval,
            this.config.spawn.intervalMs - (elapsedSec * acceleration)
        );
        state.spawnTimer = window.setTimeout(() => {
            const { width, height } = this.getCanvasSize();
            this.beanManager.createBean(width, height);
            if (this.isMakeBeanActive()) {
                this.schedule(state);
            } else {
                state.spawnTimer = null;
            }
        }, nextInterval);
    }
}
