import { BEAN_DETAIL_PATH, BEAN_SHAPE_PATH } from "../config/config.js";

export class BeanRenderer {
    constructor(config, ctx) {
        this.config = config;
        this.ctx = ctx;
        this.shapePath = new Path2D(BEAN_SHAPE_PATH);
        this.detailPath = new Path2D(BEAN_DETAIL_PATH);
    }

    draw(bean, nowMs = performance.now()) {
        const base = this.config.draw.beanBaseRadius;
        const ctx = this.ctx;
        const combustionProgress = bean.isCombusting ? (bean.combustionProgress ?? 0) : 0;
        const flameAlpha = bean.isCombusting ? Math.max(0, 1 - (combustionProgress * 0.85)) : 0;
        const flicker = bean.isCombusting ? (0.75 + (0.35 * Math.sin((nowMs * 0.03) + bean.body.position.x))) : 1;
        const beanAlpha = bean.isCombusting ? Math.max(0.1, 1 - (combustionProgress * 0.95)) : 1;

        ctx.save();
        ctx.translate(bean.body.position.x, bean.body.position.y);
        ctx.rotate(bean.body.angle);
        ctx.scale(bean.body.circleRadius / base, bean.body.circleRadius / base);
        ctx.translate(-base, -base);
        if (bean.isCombusting) {
            const cx = base;
            const cy = base;
            ctx.globalAlpha = flameAlpha;
            const flameRadius = base * (1.55 + (0.9 * combustionProgress)) * flicker;
            ctx.fillStyle = "rgba(255,98,22,0.48)";
            ctx.beginPath();
            ctx.arc(cx, cy, flameRadius, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255,210,84,0.72)";
            ctx.beginPath();
            ctx.arc(cx, cy, flameRadius * 0.72, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "rgba(255,70,24,0.82)";
            for (let i = 0; i < 6; i += 1) {
                const a = ((Math.PI * 2) / 6) * i + (nowMs * 0.006);
                const tipR = base * (2.2 + (0.8 * combustionProgress));
                ctx.beginPath();
                ctx.moveTo(cx + (Math.cos(a) * base * 0.7), cy + (Math.sin(a) * base * 0.7));
                ctx.lineTo(cx + (Math.cos(a + 0.2) * base * 1.05), cy + (Math.sin(a + 0.2) * base * 1.05));
                ctx.lineTo(cx + (Math.cos(a) * tipR), cy + (Math.sin(a) * tipR));
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = "rgba(255,236,128,0.78)";
            for (let i = 0; i < 4; i += 1) {
                const a = ((Math.PI * 2) / 4) * i - (nowMs * 0.005);
                const tipR = base * (1.7 + (0.5 * combustionProgress));
                ctx.beginPath();
                ctx.moveTo(cx + (Math.cos(a) * base * 0.45), cy + (Math.sin(a) * base * 0.45));
                ctx.lineTo(cx + (Math.cos(a + 0.16) * base * 0.75), cy + (Math.sin(a + 0.16) * base * 0.75));
                ctx.lineTo(cx + (Math.cos(a) * tipR), cy + (Math.sin(a) * tipR));
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.globalAlpha = beanAlpha;
        ctx.fillStyle = bean.color;
        ctx.fill(this.shapePath);
        ctx.strokeStyle = bean.darkerColor;
        ctx.lineWidth = 1;
        ctx.stroke(this.detailPath);
        ctx.restore();
    }
}
