export class GrinderRenderer {
    constructor(ctx) {
        this.ctx = ctx;
    }

    draw(grinderState) {
        if (!grinderState) return;
        const ctx = this.ctx;
        const leftX = grinderState.centerX - grinderState.halfGap;
        const rightX = grinderState.centerX + grinderState.halfGap;
        const y = grinderState.centerY;
        const r = grinderState.wheelRadius;

        this.drawWheel(leftX, y, r, grinderState.leftAngle);
        this.drawWheel(rightX, y, r, grinderState.rightAngle);

        ctx.strokeStyle = "rgba(180,188,200,0.8)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(leftX, y);
        ctx.lineTo(rightX, y);
        ctx.stroke();
    }

    drawWheel(x, y, radius, angle) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.fillStyle = "rgba(66,74,86,0.95)";
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(118,130,145,0.95)";
        ctx.lineWidth = 3;
        ctx.stroke();

        const teeth = 22;
        ctx.strokeStyle = "rgba(180,195,210,0.95)";
        ctx.lineWidth = 2;
        for (let i = 0; i < teeth; i += 1) {
            const a = (Math.PI * 2 * i) / teeth;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * (radius * 0.62), Math.sin(a) * (radius * 0.62));
            ctx.lineTo(Math.cos(a) * (radius * 0.98), Math.sin(a) * (radius * 0.98));
            ctx.stroke();
        }

        ctx.fillStyle = "rgba(96,106,118,1)";
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawParticles(particles, nowMs) {
        const ctx = this.ctx;
        particles.forEach((p) => {
            const lifeT = Math.min(1, (nowMs - p.bornAt) / Math.max(1, p.lifeMs));
            ctx.globalAlpha = Math.max(0, 1 - lifeT);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }
}
