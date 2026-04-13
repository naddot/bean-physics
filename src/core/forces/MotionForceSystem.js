export class MotionForceSystem {
    constructor(config, physicsWorld, beanManager, isMobileDevice) {
        this.config = config;
        this.physicsWorld = physicsWorld;
        this.beanManager = beanManager;
        this.isMobileDevice = isMobileDevice;
    }

    onMotion(state, event) {
        const now = performance.now();
        const rawAX = event.accelerationIncludingGravity?.x ?? 0;
        const rawAY = event.accelerationIncludingGravity?.y ?? 0;
        const az = event.accelerationIncludingGravity?.z ?? 0;
        const accelSmooth = this.config.motion.accelSmoothing ?? 0.85;
        const ax = (state.motion.accelX * accelSmooth) + (rawAX * (1 - accelSmooth));
        const ay = (state.motion.accelY * accelSmooth) + (rawAY * (1 - accelSmooth));
        state.motion.accelX = ax;
        state.motion.accelY = ay;

        const planar = Math.sqrt((ax * ax) + (ay * ay));
        const total = Math.max(0.001, Math.sqrt((ax * ax) + (ay * ay) + (az * az)));
        const tiltRatio = Math.min(1, planar / total);
        const directionalX = planar > 0.001 ? (-ax / planar) : 0;
        const directionalY = planar > 0.001 ? (ay / planar) : 1;

        state.motion.tiltX = directionalX;
        state.motion.tiltY = directionalY;
        const targetTiltStrength = Math.pow(tiltRatio, this.config.motion.uprightBoostExponent);
        const tiltStrengthSmooth = this.config.motion.tiltStrengthSmoothing ?? 0.82;
        state.motion.tiltStrength =
            (state.motion.tiltStrength * tiltStrengthSmooth) +
            (targetTiltStrength * (1 - tiltStrengthSmooth));

        const dtSec = state.motion.lastMotionAt > 0 ? Math.max(0.001, (now - state.motion.lastMotionAt) / 1000) : 0.016;
        const rawTiltRateX = (directionalX - state.motion.lastTiltX) / dtSec;
        const rawTiltRateY = (directionalY - state.motion.lastTiltY) / dtSec;
        const smooth = this.config.motion.tiltRateSmoothing;
        state.motion.tiltRateX = (state.motion.tiltRateX * smooth) + (rawTiltRateX * (1 - smooth));
        state.motion.tiltRateY = (state.motion.tiltRateY * smooth) + (rawTiltRateY * (1 - smooth));
        state.motion.lastTiltX = directionalX;
        state.motion.lastTiltY = directionalY;
        state.motion.lastMotionAt = now;

        const acceleration = event.acceleration;
        if (!acceleration) return;
        const shakeTotal = Math.abs(acceleration.x || 0) + Math.abs(acceleration.y || 0) + Math.abs(acceleration.z || 0);
        if (shakeTotal > this.config.motion.shakeThreshold && (Date.now() - state.motion.lastShakeAt) > this.config.motion.shakeCooldownMs) {
            state.motion.lastShakeAt = Date.now();
            state.motion.shakePending = true;
        }
    }

    apply(state) {
        if (!this.isMobileDevice) {
            this.physicsWorld.setGravityVector(0, this.config.physics.gravityY);
            return;
        }

        const gravityMagnitude =
            this.config.motion.gravityWhenFlat +
            ((this.config.motion.gravityWhenUpright - this.config.motion.gravityWhenFlat) * state.motion.tiltStrength);
        const gravitySmooth = this.config.motion.gravitySmoothing ?? 0.88;
        state.motion.gravityMagnitude =
            (state.motion.gravityMagnitude * gravitySmooth) +
            (gravityMagnitude * (1 - gravitySmooth));
        this.physicsWorld.setGravityVector(
            state.motion.tiltX * state.motion.gravityMagnitude,
            state.motion.tiltY * state.motion.gravityMagnitude
        );

        const forceScale = this.config.motion.tiltForceScale * (0.4 + (state.motion.tiltStrength * 2.0));
        const rateScale = this.config.motion.tiltRateForceScale * (0.25 + (state.motion.tiltStrength * 1.75));
        this.beanManager.forEach((bean) => {
            window.Matter.Body.applyForce(bean.body, bean.body.position, {
                x: (-state.motion.accelX * forceScale * bean.body.mass) + (state.motion.tiltRateX * rateScale * bean.body.mass),
                y: (state.motion.accelY * forceScale * bean.body.mass) + (state.motion.tiltRateY * rateScale * bean.body.mass)
            });
        });

        if (state.motion.shakePending) {
            this.beanManager.forEach((bean) => {
                window.Matter.Body.applyForce(bean.body, bean.body.position, {
                    x: (Math.random() - 0.5) * this.config.motion.shakeForceScale * bean.body.mass,
                    y: (Math.random() - 0.5) * this.config.motion.shakeForceScale * bean.body.mass
                });
            });
            state.motion.shakePending = false;
        }
    }
}
