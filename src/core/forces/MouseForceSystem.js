export class MouseForceSystem {
    constructor(config, beanManager) {
        this.config = config;
        this.beanManager = beanManager;
    }

    apply(state) {
        if (!state.mouse.active) return;
        this.beanManager.forEach((bean) => {
            const dx = bean.body.position.x - state.mouse.x;
            const dy = bean.body.position.y - state.mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0.001 || distance > this.config.mouse.influenceRadius) return;
            const falloff = 1 - (distance / this.config.mouse.influenceRadius);
            const dragSpeed = Math.sqrt((state.mouse.vx ** 2) + (state.mouse.vy ** 2));
            const dragBoost = Math.min(this.config.mouse.maxDragBoost, 1 + (dragSpeed * this.config.mouse.dragBoostPerPixel));
            const radialForce = falloff * this.config.mouse.forceScale * dragBoost * bean.body.mass;
            window.Matter.Body.applyForce(bean.body, bean.body.position, {
                x: (dx / distance) * radialForce + (state.mouse.vx * this.config.mouse.velocityForceScale * bean.body.mass),
                y: (dy / distance) * radialForce + (state.mouse.vy * this.config.mouse.velocityForceScale * bean.body.mass)
            });
        });
    }
}
