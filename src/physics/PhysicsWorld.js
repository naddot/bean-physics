export class PhysicsWorld {
    constructor(config) {
        if (!window.Matter) {
            throw new Error("Matter.js is required but was not loaded.");
        }

        this.config = config;
        this.Matter = window.Matter;
        const { Engine } = this.Matter;
        this.engine = Engine.create({
            gravity: { x: 0, y: this.config.physics.gravityY },
            positionIterations: this.config.physics.positionIterations,
            velocityIterations: this.config.physics.velocityIterations,
            constraintIterations: this.config.physics.constraintIterations
        });
        this.boundaries = [];
    }

    getEngine() {
        return this.engine;
    }

    onCollisionStart(handler) {
        const { Events } = this.Matter;
        Events.on(this.engine, "collisionStart", handler);
    }

    update(deltaMs) {
        const { Engine } = this.Matter;
        Engine.update(this.engine, deltaMs);
    }

    resizeBounds(width, height) {
        const { World, Bodies } = this.Matter;
        if (this.boundaries.length > 0) {
            World.remove(this.engine.world, this.boundaries);
        }

        const t = this.config.physics.wallThickness;
        this.boundaries = [
            Bodies.rectangle(width / 2, -t / 2, width, t, { isStatic: true }),
            Bodies.rectangle(width / 2, height + t / 2, width, t, { isStatic: true }),
            Bodies.rectangle(-t / 2, height / 2, t, height, { isStatic: true }),
            Bodies.rectangle(width + t / 2, height / 2, t, height, { isStatic: true })
        ];
        World.add(this.engine.world, this.boundaries);
    }

    createBeanBody(canvasWidth, canvasHeight) {
        const { Bodies, Body, World } = this.Matter;
        const radius = this.config.bean.radius;
        const body = Bodies.circle(
            radius + Math.random() * (canvasWidth - radius * 2),
            radius + Math.random() * (canvasHeight - radius * 2),
            radius,
            {
                restitution: this.config.bean.restitution,
                friction: this.config.bean.friction,
                frictionAir: this.config.bean.frictionAir,
                density: this.config.bean.density
            }
        );

        Body.setVelocity(body, {
            x: (Math.random() - 0.5) * this.config.bean.initialVelocityX,
            y: (Math.random() - 0.6) * this.config.bean.initialVelocityY
        });
        World.add(this.engine.world, body);
        return body;
    }
}
