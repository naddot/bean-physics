export class CombustionLifecycleService {
    constructor(config, physicsWorld) {
        this.config = config;
        this.physicsWorld = physicsWorld;
        this.combustionArmed = false;
    }

    update(beans, averageTempC, nowMs = performance.now(), deltaMs = 16.7) {
        const cfg = this.config.bean.combustion;
        if (!cfg?.enabled || beans.length === 0) return { survivors: beans, removed: 0 };
        const shouldIgnite = averageTempC >= cfg.triggerAverageTempC;
        if (!shouldIgnite) {
            this.combustionArmed = false;
        }

        const hasCombustingBean = beans.some((bean) => bean.isCombusting);
        if (shouldIgnite && !this.combustionArmed && !hasCombustingBean) {
            const seedIndex = Math.floor(Math.random() * beans.length);
            beans[seedIndex]?.ignite(nowMs);
            this.combustionArmed = true;
        }

        const spreadRadius = cfg.spreadRadius ?? 68;
        const spreadRadiusSq = spreadRadius * spreadRadius;
        const spreadRate = cfg.spreadChancePerSecond ?? 2.2;
        const dtSec = Math.max(0.001, deltaMs / 1000);
        const toIgnite = [];
        if (hasCombustingBean || beans.some((bean) => bean.isCombusting)) {
            for (let i = 0; i < beans.length; i += 1) {
                const source = beans[i];
                if (!source.isCombusting) continue;
                for (let j = 0; j < beans.length; j += 1) {
                    if (i === j) continue;
                    const target = beans[j];
                    if (target.isCombusting) continue;
                    const dx = target.body.position.x - source.body.position.x;
                    const dy = target.body.position.y - source.body.position.y;
                    const distSq = (dx * dx) + (dy * dy);
                    if (distSq > spreadRadiusSq) continue;
                    const proximity = 1 - (distSq / spreadRadiusSq);
                    const chance = spreadRate * proximity * dtSec;
                    if (Math.random() < chance) {
                        toIgnite.push(target);
                    }
                }
            }
        }
        toIgnite.forEach((bean) => bean.ignite(nowMs));

        const survivors = [];
        let removed = 0;
        beans.forEach((bean) => {
            const disintegrated = bean.updateCombustion(nowMs);
            if (disintegrated) {
                this.physicsWorld.removeBody(bean.body);
                removed += 1;
                return;
            }
            survivors.push(bean);
        });
        return { survivors, removed };
    }
}
