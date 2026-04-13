export class PaddleRenderer {
    constructor(config, ctx) {
        this.config = config;
        this.ctx = ctx;
    }

    draw(paddleState) {
        if (!paddleState?.active) return;
        const paddleCfg = this.config.mouse.paddle;
        if (!paddleCfg?.enabled) return;
        const ctx = this.ctx;
        const bladeCount = Math.max(1, paddleCfg.bladeCount);
        const armLength = Math.max(12, paddleState.radius - 8);

        ctx.save();
        ctx.translate(paddleState.x, paddleState.y);

        ctx.strokeStyle = "rgba(112,122,134,0.95)";
        ctx.lineWidth = Math.max(3, paddleCfg.bladeThickness * 0.5);
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i < bladeCount; i += 1) {
            const a = paddleState.angle + ((Math.PI * 2 * i) / bladeCount);
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * armLength, Math.sin(a) * armLength);
        }
        ctx.stroke();

        ctx.fillStyle = "rgba(86,95,106,0.98)";
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
