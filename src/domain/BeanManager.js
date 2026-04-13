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
}
