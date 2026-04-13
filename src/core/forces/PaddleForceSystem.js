export class PaddleForceSystem {
    constructor(config, beanManager) {
        this.config = config;
        this.beanManager = beanManager;
    }

    spawn(state, x, y, nowMs) {
        if (!this.config.mouse.paddle?.enabled) return;
        state.paddle.active = true;
        state.paddle.x = x;
        state.paddle.y = y;
        state.paddle.radius = this.config.mouse.paddle.startRadius;
        state.paddle.angle = 0;
        state.paddle.startedAt = nowMs;
        state.paddle.lastUpdatedAt = nowMs;
    }

    normalizeAngle(angle) {
        let out = angle;
        while (out > Math.PI) out -= Math.PI * 2;
        while (out < -Math.PI) out += Math.PI * 2;
        return out;
    }

    update(state, timeStamp) {
        const paddleCfg = this.config.mouse.paddle;
        if (!paddleCfg?.enabled || !state.paddle.active) return;
        const elapsed = timeStamp - state.paddle.startedAt;
        const dtSec = Math.max(0.001, (timeStamp - state.paddle.lastUpdatedAt) / 1000);
        const expandT = Math.min(1, elapsed / paddleCfg.expandMs);
        state.paddle.radius = paddleCfg.startRadius + ((paddleCfg.maxRadius - paddleCfg.startRadius) * expandT);
        state.paddle.angle += paddleCfg.angularSpeedRadPerSec * dtSec;
        state.paddle.lastUpdatedAt = timeStamp;

        const bladeArcHalf = paddleCfg.bladeArcWidthRad / 2;
        this.beanManager.forEach((bean) => {
            const dx = bean.body.position.x - state.paddle.x;
            const dy = bean.body.position.y - state.paddle.y;
            const distance = Math.sqrt((dx * dx) + (dy * dy));
            if (distance <= 0.001 || distance > state.paddle.radius + paddleCfg.bladeThickness) return;

            const radialX = dx / distance;
            const radialY = dy / distance;
            const beanAngle = Math.atan2(dy, dx);
            const normalizedDistance = Math.min(1, distance / Math.max(1, state.paddle.radius));
            const distanceFalloff = 1 - (0.35 * normalizedDistance);
            const mass = bean.body.mass;

            for (let i = 0; i < paddleCfg.bladeCount; i += 1) {
                const bladeAngle = state.paddle.angle + ((Math.PI * 2 * i) / paddleCfg.bladeCount);
                const diff = Math.abs(this.normalizeAngle(beanAngle - bladeAngle));
                if (diff > bladeArcHalf) continue;

                const alignment = 1 - (diff / bladeArcHalf);
                const tangentialX = -radialY;
                const tangentialY = radialX;
                const tangentialForce = paddleCfg.tangentialForceScale * alignment * distanceFalloff * mass;
                const radialForce = paddleCfg.radialForceScale * alignment * distanceFalloff * mass;
                window.Matter.Body.applyForce(bean.body, bean.body.position, {
                    x: (tangentialX * tangentialForce) + (radialX * radialForce),
                    y: (tangentialY * tangentialForce) + (radialY * radialForce)
                });

                const throwSpeed =
                    paddleCfg.scoopVelocityBase +
                    (alignment * paddleCfg.scoopVelocityBoost * distanceFalloff);
                const targetVX = (tangentialX * throwSpeed) + (radialX * (throwSpeed * 0.55));
                const targetVY = (tangentialY * throwSpeed) + (radialY * (throwSpeed * 0.55));
                const blendedVX = (bean.body.velocity.x * 0.2) + (targetVX * 0.8);
                const blendedVY = (bean.body.velocity.y * 0.2) + (targetVY * 0.8);
                const speed = Math.sqrt((blendedVX * blendedVX) + (blendedVY * blendedVY));
                const cap = Math.max(1, paddleCfg.maxBeanSpeed);
                if (speed > cap) {
                    const n = cap / speed;
                    window.Matter.Body.setVelocity(bean.body, { x: blendedVX * n, y: blendedVY * n });
                } else {
                    window.Matter.Body.setVelocity(bean.body, { x: blendedVX, y: blendedVY });
                }
                break;
            }
        });
    }
}
