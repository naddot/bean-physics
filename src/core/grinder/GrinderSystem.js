export class GrinderSystem {
    constructor(config, beanManager, physicsWorld) {
        this.config = config;
        this.beanManager = beanManager;
        this.physicsWorld = physicsWorld;
        this.state = {
            started: false,
            placed: false,
            pressing: false,
            centerX: 0,
            centerY: 0,
            halfGap: config.grinder.initialHalfGap,
            targetHalfGap: config.grinder.minHalfGap,
            leftAngle: 0,
            rightAngle: 0,
            particles: []
        };
        this.leftWheelBody = null;
        this.rightWheelBody = null;
    }

    isStarted() {
        return this.state.started;
    }

    startAt(x, y) {
        if (this.leftWheelBody) this.physicsWorld.removeBody(this.leftWheelBody);
        if (this.rightWheelBody) this.physicsWorld.removeBody(this.rightWheelBody);
        this.state.started = true;
        this.state.placed = true;
        this.state.pressing = false;
        this.state.centerX = x;
        this.state.centerY = y;
        this.state.halfGap = this.config.grinder.initialHalfGap;
        this.state.leftAngle = 0;
        this.state.rightAngle = 0;
        const leftX = this.state.centerX - this.state.halfGap;
        const rightX = this.state.centerX + this.state.halfGap;
        const centerY = this.state.centerY;
        this.leftWheelBody = this.physicsWorld.createGrinderWheelBody(leftX, centerY, this.config.grinder.wheelRadius);
        this.rightWheelBody = this.physicsWorld.createGrinderWheelBody(rightX, centerY, this.config.grinder.wheelRadius);
    }

    setCenter(x, y) {
        if (!this.state.placed) return;
        this.state.centerX = x;
        this.state.centerY = y;
    }

    setPressing(isPressing) {
        this.state.pressing = Boolean(isPressing);
    }

    getRenderState() {
        if (!this.state.placed) return null;
        return {
            centerX: this.state.centerX,
            centerY: this.state.centerY,
            halfGap: this.state.halfGap,
            wheelRadius: this.config.grinder.wheelRadius,
            wheelThickness: this.config.grinder.wheelThickness,
            leftAngle: this.state.leftAngle,
            rightAngle: this.state.rightAngle
        };
    }

    getParticles() {
        return this.state.particles;
    }

    update(dtMs, nowMs, canvasWidth, canvasHeight) {
        if (!this.state.placed) {
            this.updateParticles(dtMs, nowMs, canvasWidth, canvasHeight);
            return;
        }
        const dtSec = Math.max(0.001, dtMs / 1000);
        this.state.leftAngle += this.config.grinder.angularSpeedRadPerSec * dtSec;
        this.state.rightAngle -= this.config.grinder.angularSpeedRadPerSec * dtSec;
        const targetGap = this.state.pressing ? this.state.targetHalfGap : this.config.grinder.initialHalfGap;
        const speed = this.config.grinder.closeSpeedPxPerSec * dtSec;
        if (this.state.halfGap > targetGap) {
            this.state.halfGap = Math.max(targetGap, this.state.halfGap - speed);
        } else if (this.state.halfGap < targetGap) {
            this.state.halfGap = Math.min(targetGap, this.state.halfGap + speed);
        }

        const wheelRadius = this.config.grinder.wheelRadius;
        const crushHalfHeight = wheelRadius * this.config.grinder.crushZoneHeightFactor;
        const leftX = this.state.centerX - this.state.halfGap;
        const rightX = this.state.centerX + this.state.halfGap;
        this.physicsWorld.setBodyTransform(this.leftWheelBody, leftX, this.state.centerY, this.state.leftAngle);
        this.physicsWorld.setBodyTransform(this.rightWheelBody, rightX, this.state.centerY, this.state.rightAngle);
        const survivors = [];

        this.beanManager.getAll().forEach((bean) => {
            const bx = bean.body.position.x;
            const by = bean.body.position.y;
            const beanRadius = Math.max(4, bean.body.circleRadius || this.config.bean.radius);
            const dy = Math.abs(by - this.state.centerY);
            if (dy > crushHalfHeight) {
                survivors.push(bean);
                return;
            }

            const distL = Math.hypot(bx - leftX, by - this.state.centerY);
            const distR = Math.hypot(bx - rightX, by - this.state.centerY);
            const catchesLeftWheel = distL < (wheelRadius + beanRadius);
            const catchesRightWheel = distR < (wheelRadius + beanRadius);
            const catchesWheel = catchesLeftWheel && catchesRightWheel;
            const inNip = Math.abs(bx - this.state.centerX) <= (this.state.halfGap + beanRadius);
            if (!catchesWheel || !inNip) {
                survivors.push(bean);
                return;
            }

            const compression = 1 - (this.state.halfGap / Math.max(1, this.config.grinder.initialHalfGap));
            this.spawnPowderParticles(bean.body.position.x, bean.body.position.y, nowMs, compression);
            this.physicsWorld.removeBody(bean.body);
        });

        this.beanManager.replaceAll(survivors);
        this.updateParticles(dtMs, nowMs, canvasWidth, canvasHeight);
    }

    spawnPowderParticles(x, y, nowMs, compression = 0.4) {
        const min = this.config.grinder.particleCountMin;
        const max = this.config.grinder.particleCountMax;
        const fineFactor = Math.max(0, Math.min(1, compression));
        const targetCount = min + ((max - min) * (0.45 + (fineFactor * 0.9)));
        const count = Math.max(min, Math.floor(targetCount));
        for (let i = 0; i < count; i += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 45 + (Math.random() * 220);
            this.state.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                bornAt: nowMs,
                lifeMs: this.config.grinder.particleMaxLifeMs * (0.55 + (Math.random() * 0.65)),
                size: 0.8 + (Math.random() * (2.6 - (fineFactor * 1.2))),
                color: Math.random() > 0.5 ? "#b78f60" : "#8f6a46"
            });
        }
    }

    updateParticles(dtMs, nowMs, canvasWidth, canvasHeight) {
        const dtSec = Math.max(0.001, dtMs / 1000);
        const gravity = this.config.grinder.particleGravity;
        const damping = this.config.grinder.particleDamping;
        this.state.particles = this.state.particles.filter((p) => {
            if ((nowMs - p.bornAt) > p.lifeMs) return false;
            p.vy += gravity * dtSec;
            p.vx *= damping;
            p.vy *= damping;
            p.x += p.vx * dtSec;
            p.y += p.vy * dtSec;
            if (p.y > canvasHeight - 6) {
                p.y = canvasHeight - 6;
                p.vy *= -0.25;
                p.vx *= 0.82;
            }
            if (p.x < 0 || p.x > canvasWidth) return false;
            return true;
        });
    }
}
