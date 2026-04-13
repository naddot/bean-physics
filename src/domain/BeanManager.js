import { Bean } from "./Bean.js";

export class BeanManager {
    constructor(config, physicsWorld, roastModel) {
        this.config = config;
        this.physicsWorld = physicsWorld;
        this.roastModel = roastModel;
        this.beans = [];
    }

    createBean(canvasWidth, canvasHeight) {
        const body = this.physicsWorld.createBeanBody(canvasWidth, canvasHeight);
        const startColor = this.config.startingColors[Math.floor(Math.random() * this.config.startingColors.length)];
        const bean = new Bean(body, startColor, this.config);
        this.beans.push(bean);
        return bean;
    }

    forEach(callback) {
        this.beans.forEach(callback);
    }

    getAll() {
        return this.beans;
    }

    findByBody(body) {
        return this.beans.find((bean) => bean.body === body);
    }

    handleCollisionPair(pair) {
        const beanA = this.findByBody(pair.bodyA);
        const beanB = this.findByBody(pair.bodyB);
        if (!beanA || !beanB) return;

        const rvx = pair.bodyA.velocity.x - pair.bodyB.velocity.x;
        const rvy = pair.bodyA.velocity.y - pair.bodyB.velocity.y;
        const normal = pair.collision.normal;
        const impact = Math.abs((rvx * normal.x) + (rvy * normal.y));
        const energyDelta = impact * (pair.bodyA.mass + pair.bodyB.mass) * this.config.analytics.energyImpactScale;
        beanA.applyCollisionEnergy(energyDelta * 0.5, this.roastModel);
        beanB.applyCollisionEnergy(energyDelta * 0.5, this.roastModel);
    }

    applyNeighborEnergyTransfer(deltaMs) {
        const cfg = this.config.bean.energyTransfer;
        if (!cfg?.enabled || this.beans.length < 2) return;

        const dtSec = Math.max(0.001, deltaMs / 1000);
        const radiusSq = cfg.radius * cfg.radius;
        const maxPerPair = cfg.maxPerPairPerSecond * dtSec;

        for (let i = 0; i < this.beans.length - 1; i += 1) {
            const a = this.beans[i];
            for (let j = i + 1; j < this.beans.length; j += 1) {
                const b = this.beans[j];
                const dx = b.body.position.x - a.body.position.x;
                const dy = b.body.position.y - a.body.position.y;
                const distSq = (dx * dx) + (dy * dy);
                if (distSq > radiusSq) continue;

                const diff = a.totalForce - b.totalForce;
                if (Math.abs(diff) < 0.001) continue;

                const proximity = 1 - (distSq / radiusSq);
                const potential = Math.abs(diff) * cfg.ratePerSecond * proximity * dtSec;
                const transfer = Math.min(maxPerPair, potential);
                if (transfer <= 0) continue;

                if (diff > 0) {
                    a.totalForce = Math.max(0, a.totalForce - transfer);
                    b.applyCollisionEnergy(transfer, this.roastModel);
                } else {
                    b.totalForce = Math.max(0, b.totalForce - transfer);
                    a.applyCollisionEnergy(transfer, this.roastModel);
                }
            }
        }
    }
}
