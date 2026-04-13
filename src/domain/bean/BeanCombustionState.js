import { clamp } from "../../util/color.js";

export class BeanCombustionState {
    static ignite(bean, nowMs = performance.now()) {
        if (bean.isCombusting) return;
        bean.isCombusting = true;
        bean.combustionStartedAt = nowMs;
        bean.combustionProgress = 0;
        bean.combustionScale = 1;
        bean.body.frictionAir = Math.max(bean.body.frictionAir, 0.05);
        bean.body.restitution = Math.min(bean.body.restitution, 0.2);
    }

    static update(bean, nowMs = performance.now()) {
        const cfg = bean.config.bean.combustion;
        if (!cfg?.enabled || !bean.isCombusting) return false;
        const duration = Math.max(1, cfg.durationMs);
        const progress = clamp((nowMs - bean.combustionStartedAt) / duration, 0, 1);
        bean.combustionProgress = progress;

        const targetScale = Math.max(0.01, 1 - ((1 - cfg.minScaleFactor) * progress));
        if (window.Matter?.Body && Math.abs(targetScale - bean.combustionScale) > 0.001) {
            const ratio = targetScale / Math.max(0.001, bean.combustionScale);
            window.Matter.Body.scale(bean.body, ratio, ratio);
            bean.combustionScale = targetScale;
        }

        return progress >= 1;
    }
}
