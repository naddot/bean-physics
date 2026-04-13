export class CleanupService {
    constructor(config, physicsWorld) {
        this.config = config;
        this.physicsWorld = physicsWorld;
    }

    removeInactiveBeans(beans, nowMs = performance.now()) {
        const cfg = this.config.bean.inactivityRemoval;
        if (!cfg?.enabled || beans.length === 0) return { survivors: beans, removed: 0 };

        const survivors = [];
        let removed = 0;
        beans.forEach((bean) => {
            const idleMs = nowMs - (bean.lastEnergyChangeAt ?? nowMs);
            if (idleMs >= cfg.timeoutMs) {
                this.physicsWorld.removeBody(bean.body);
                removed += 1;
                return;
            }
            survivors.push(bean);
        });
        return { survivors, removed };
    }

    removeBrokenOrStuckBeans(beans, nowMs = performance.now(), canvasWidth, canvasHeight) {
        const cfg = this.config.bean.safetyCleanup;
        if (!cfg?.enabled || beans.length === 0) return { survivors: beans, removed: 0 };

        const margin = cfg.offscreenMarginPx;
        const minMove = cfg.minMovementPx;
        const minSpeed = cfg.minSpeed;
        const stuckTimeoutMs = cfg.stuckTimeoutMs;

        const survivors = [];
        let removed = 0;
        beans.forEach((bean) => {
            const { x, y } = bean.body.position;
            const { x: vx, y: vy } = bean.body.velocity;

            const invalid =
                !Number.isFinite(x) || !Number.isFinite(y) ||
                !Number.isFinite(vx) || !Number.isFinite(vy);
            if (invalid) {
                this.physicsWorld.removeBody(bean.body);
                removed += 1;
                return;
            }

            const offscreen =
                x < -margin || x > (canvasWidth + margin) ||
                y < -margin || y > (canvasHeight + margin);
            if (offscreen) {
                this.physicsWorld.removeBody(bean.body);
                removed += 1;
                return;
            }

            const dx = x - bean.lastX;
            const dy = y - bean.lastY;
            const moved = Math.sqrt((dx * dx) + (dy * dy));
            const speed = Math.sqrt((vx * vx) + (vy * vy));
            if (moved >= minMove || speed >= minSpeed) {
                bean.lastMovementAt = nowMs;
            }
            bean.lastX = x;
            bean.lastY = y;

            const idleMovementMs = nowMs - (bean.lastMovementAt ?? nowMs);
            const idleMeaningfulEnergyMs = nowMs - (bean.lastMeaningfulEnergyChangeAt ?? nowMs);
            if (idleMovementMs >= stuckTimeoutMs && idleMeaningfulEnergyMs >= stuckTimeoutMs) {
                this.physicsWorld.removeBody(bean.body);
                removed += 1;
                return;
            }

            survivors.push(bean);
        });

        return { survivors, removed };
    }
}
