export class SimulationController {
    constructor(config, canvas, ctx, physicsWorld, beanManager, analyticsService, hudView, inputController, runtimeChecks) {
        this.config = config;
        this.canvas = canvas;
        this.ctx = ctx;
        this.physicsWorld = physicsWorld;
        this.beanManager = beanManager;
        this.analyticsService = analyticsService;
        this.hudView = hudView;
        this.inputController = inputController;
        this.runtimeChecks = runtimeChecks;
        this.state = {
            spawnTimer: null,
            debugEnabled: false,
            mouse: { active: false, x: 0, y: 0, vx: 0, vy: 0 },
            motion: {
                accelX: 0,
                accelY: 0,
                tiltX: 0,
                tiltY: 1,
                tiltStrength: 1,
                tiltRateX: 0,
                tiltRateY: 0,
                lastTiltX: 0,
                lastTiltY: 1,
                lastMotionAt: 0,
                shakePending: false,
                lastShakeAt: 0
            },
            activeHudButton: null,
            lastFrameTime: 0
        };
    }

    init() {
        this.runtimeChecks?.runRoastModelChecks();
        this.physicsWorld.onCollisionStart((event) => {
            event.pairs.forEach((pair) => this.beanManager.handleCollisionPair(pair));
        });
        this.resizeWorld();
        this.inputController.bind();
        window.requestAnimationFrame((ts) => this.loop(ts));
    }

    resizeWorld = () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.physicsWorld.resizeBounds(this.canvas.width, this.canvas.height);
    };

    startSpawnStream = (event) => {
        if (event && event.preventDefault) event.preventDefault();
        if (this.state.spawnTimer !== null) return;
        this.beanManager.createBean(this.canvas.width, this.canvas.height);
        this.state.spawnTimer = window.setInterval(
            () => this.beanManager.createBean(this.canvas.width, this.canvas.height),
            this.config.spawn.intervalMs
        );
    };

    stopSpawnStream = () => {
        if (this.state.spawnTimer === null) return;
        window.clearInterval(this.state.spawnTimer);
        this.state.spawnTimer = null;
    };

    toggleDebug = () => {
        this.state.debugEnabled = !this.state.debugEnabled;
    };

    isPointInRect(x, y, rect) {
        return rect && x >= rect.x && x <= (rect.x + rect.width) && y >= rect.y && y <= (rect.y + rect.height);
    }

    applyMouseClickBurst(x, y) {
        this.beanManager.forEach((bean) => {
            const dx = bean.body.position.x - x;
            const dy = bean.body.position.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0.001 || distance >= this.config.mouse.clickBurstRadius) return;
            const burst = (1 - (distance / this.config.mouse.clickBurstRadius)) * this.config.mouse.clickBurstForceScale * bean.body.mass;
            window.Matter.Body.applyForce(bean.body, bean.body.position, { x: (dx / distance) * burst, y: (dy / distance) * burst });
        });
    }

    onPointerDown = (event) => {
        const clickX = event.clientX;
        const clickY = event.clientY;
        const { makeBean, debug } = this.hudView.getButtonRects();

        if (this.isPointInRect(clickX, clickY, makeBean)) {
            this.state.activeHudButton = "makeBean";
            this.startSpawnStream(event);
            return;
        }
        if (this.isPointInRect(clickX, clickY, debug)) {
            this.state.activeHudButton = "debug";
            this.toggleDebug();
            return;
        }

        this.state.mouse.active = true;
        this.state.mouse.x = clickX;
        this.state.mouse.y = clickY;
        this.state.mouse.vx = 0;
        this.state.mouse.vy = 0;
        this.applyMouseClickBurst(clickX, clickY);
    };

    onPointerMove = (event) => {
        this.state.mouse.vx = event.clientX - this.state.mouse.x;
        this.state.mouse.vy = event.clientY - this.state.mouse.y;
        this.state.mouse.x = event.clientX;
        this.state.mouse.y = event.clientY;
    };

    onPointerUp = () => {
        if (this.state.activeHudButton === "makeBean") {
            this.stopSpawnStream();
        }
        this.state.activeHudButton = null;
        this.state.mouse.active = false;
        this.state.mouse.vx = 0;
        this.state.mouse.vy = 0;
    };

    onMotion = (event) => {
        const now = performance.now();
        const ax = event.accelerationIncludingGravity?.x ?? 0;
        const ay = event.accelerationIncludingGravity?.y ?? 0;
        const az = event.accelerationIncludingGravity?.z ?? 0;
        this.state.motion.accelX = ax;
        this.state.motion.accelY = ay;

        const planar = Math.sqrt((ax * ax) + (ay * ay));
        const total = Math.max(0.001, Math.sqrt((ax * ax) + (ay * ay) + (az * az)));
        const tiltRatio = Math.min(1, planar / total);
        const directionalX = planar > 0.001 ? (-ax / planar) : 0;
        const directionalY = planar > 0.001 ? (ay / planar) : 1;

        this.state.motion.tiltX = directionalX;
        this.state.motion.tiltY = directionalY;
        this.state.motion.tiltStrength = Math.pow(tiltRatio, this.config.motion.uprightBoostExponent);

        const dtSec = this.state.motion.lastMotionAt > 0 ? Math.max(0.001, (now - this.state.motion.lastMotionAt) / 1000) : 0.016;
        const rawTiltRateX = (directionalX - this.state.motion.lastTiltX) / dtSec;
        const rawTiltRateY = (directionalY - this.state.motion.lastTiltY) / dtSec;
        const smooth = this.config.motion.tiltRateSmoothing;
        this.state.motion.tiltRateX = (this.state.motion.tiltRateX * smooth) + (rawTiltRateX * (1 - smooth));
        this.state.motion.tiltRateY = (this.state.motion.tiltRateY * smooth) + (rawTiltRateY * (1 - smooth));
        this.state.motion.lastTiltX = directionalX;
        this.state.motion.lastTiltY = directionalY;
        this.state.motion.lastMotionAt = now;

        const acceleration = event.acceleration;
        if (!acceleration) return;
        const shakeTotal = Math.abs(acceleration.x || 0) + Math.abs(acceleration.y || 0) + Math.abs(acceleration.z || 0);
        if (shakeTotal > this.config.motion.shakeThreshold && (Date.now() - this.state.motion.lastShakeAt) > this.config.motion.shakeCooldownMs) {
            this.state.motion.lastShakeAt = Date.now();
            this.state.motion.shakePending = true;
        }
    };

    onRequestMotionPermission = () => {
        DeviceMotionEvent.requestPermission()
            .then((response) => {
                if (response !== "granted") return;
                this.inputController.bindMotionAfterPermission();
            })
            .catch(console.error);
    };

    applyMotionForces() {
        const gravityMagnitude =
            this.config.motion.gravityWhenFlat +
            ((this.config.motion.gravityWhenUpright - this.config.motion.gravityWhenFlat) * this.state.motion.tiltStrength);
        this.physicsWorld.setGravityVector(
            this.state.motion.tiltX * gravityMagnitude,
            this.state.motion.tiltY * gravityMagnitude
        );

        const forceScale = this.config.motion.tiltForceScale * (0.4 + (this.state.motion.tiltStrength * 2.0));
        const rateScale = this.config.motion.tiltRateForceScale * (0.25 + (this.state.motion.tiltStrength * 1.75));
        this.beanManager.forEach((bean) => {
            window.Matter.Body.applyForce(bean.body, bean.body.position, {
                x: (-this.state.motion.accelX * forceScale * bean.body.mass) + (this.state.motion.tiltRateX * rateScale * bean.body.mass),
                y: (this.state.motion.accelY * forceScale * bean.body.mass) + (this.state.motion.tiltRateY * rateScale * bean.body.mass)
            });
        });

        if (this.state.motion.shakePending) {
            this.beanManager.forEach((bean) => {
                window.Matter.Body.applyForce(bean.body, bean.body.position, {
                    x: (Math.random() - 0.5) * this.config.motion.shakeForceScale * bean.body.mass,
                    y: (Math.random() - 0.5) * this.config.motion.shakeForceScale * bean.body.mass
                });
            });
            this.state.motion.shakePending = false;
        }
    }

    applyMouseForces() {
        if (!this.state.mouse.active) return;
        this.beanManager.forEach((bean) => {
            const dx = bean.body.position.x - this.state.mouse.x;
            const dy = bean.body.position.y - this.state.mouse.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 0.001 || distance > this.config.mouse.influenceRadius) return;
            const falloff = 1 - (distance / this.config.mouse.influenceRadius);
            const dragSpeed = Math.sqrt((this.state.mouse.vx ** 2) + (this.state.mouse.vy ** 2));
            const dragBoost = Math.min(this.config.mouse.maxDragBoost, 1 + (dragSpeed * this.config.mouse.dragBoostPerPixel));
            const radialForce = falloff * this.config.mouse.forceScale * dragBoost * bean.body.mass;
            window.Matter.Body.applyForce(bean.body, bean.body.position, {
                x: (dx / distance) * radialForce + (this.state.mouse.vx * this.config.mouse.velocityForceScale * bean.body.mass),
                y: (dy / distance) * radialForce + (this.state.mouse.vy * this.config.mouse.velocityForceScale * bean.body.mass)
            });
        });
    }

    loop(timeStamp) {
        const dtMs = Math.min(33.3, timeStamp - (this.state.lastFrameTime || timeStamp));
        this.state.lastFrameTime = timeStamp;
        this.applyMotionForces();
        this.applyMouseForces();
        this.physicsWorld.update(dtMs);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.beanManager.forEach((bean) => this.hudView.drawBean(bean, this.state.debugEnabled));
        this.analyticsService.update(this.beanManager.getAll(), timeStamp);
        this.runtimeChecks?.runAnalyticsChecks(this.analyticsService.getMetrics(), this.beanManager.getAll().length);
        this.hudView.draw(this.analyticsService.getMetrics(), this.beanManager.getAll().length, this.state.debugEnabled, this.canvas.width);

        window.requestAnimationFrame((ts) => this.loop(ts));
    }
}
