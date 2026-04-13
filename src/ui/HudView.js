import { formatDuration } from "../util/time.js";
import { clamp } from "../util/color.js";
import { BEAN_DETAIL_PATH, BEAN_SHAPE_PATH } from "../config/config.js";

export class HudView {
    constructor(config, ctx, hudLayout) {
        this.config = config;
        this.ctx = ctx;
        this.hudLayout = hudLayout;
        this.buttonRects = { makeBean: null };
        this.shapePath = new Path2D(BEAN_SHAPE_PATH);
        this.detailPath = new Path2D(BEAN_DETAIL_PATH);
    }

    getButtonRects() {
        return this.buttonRects;
    }

    drawBean(bean) {
        const base = this.config.draw.beanBaseRadius;
        const ctx = this.ctx;

        ctx.save();
        ctx.translate(bean.body.position.x, bean.body.position.y);
        ctx.rotate(bean.body.angle);
        ctx.scale(bean.body.circleRadius / base, bean.body.circleRadius / base);
        ctx.translate(-base, -base);
        ctx.fillStyle = bean.color;
        ctx.fill(this.shapePath);
        ctx.strokeStyle = bean.darkerColor;
        ctx.lineWidth = 1;
        ctx.stroke(this.detailPath);
        ctx.restore();
    }

    drawMousePaddle(paddleState) {
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

    draw(metrics, beanCount, canvasWidth, isMakeBeanPressed = false) {
        const ctx = this.ctx;
        const L = this.hudLayout.compute(canvasWidth);
        const compactScale = L.mode === "mobile" ? clamp((L.headerWidth - 40) / 360, 0.82, 1) : 1;
        const titleFont = `bold ${Math.round(14 * compactScale)}px Arial`;
        const bodyFont = `${Math.round(12 * compactScale)}px Arial`;
        const tempFont = `bold ${Math.round(18 * compactScale)}px Arial`;
        const rorFont = `bold ${Math.round(16 * compactScale)}px Arial`;
        const ultraNarrow = L.mode === "mobile" && L.isUltraNarrow;
        this.buttonRects.makeBean = L.makeBeanRect;

        ctx.fillStyle = metrics.averageColor;
        ctx.fillRect(L.headerX, L.headerY, L.headerWidth, L.headerHeight);
        ctx.fillStyle = "rgba(10,14,20,0.56)";
        ctx.fillRect(L.headerX, L.headerY, L.headerWidth, L.headerHeight);
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.strokeRect(L.headerX, L.headerY, L.headerWidth, L.headerHeight);

        ctx.fillStyle = "#e8edf5";
        ctx.font = titleFont;
        if (L.mode === "mobile") {
            ctx.fillText("Roasting Console", L.leftX, L.topY + 52);
        } else {
            ctx.fillText("Roasting Console", L.leftX, L.topY);
        }

        ctx.fillStyle = "#dbe2ec";
        ctx.font = bodyFont;
        const statsStartY = L.mode === "mobile" ? L.topY + 70 : L.topY;
        ctx.fillText(`Time ${formatDuration(metrics.elapsedRoastMs)}`, L.leftX, statsStartY + 20);
        ctx.fillText(`Beans ${beanCount}`, L.leftX + Math.round(110 * compactScale), statsStartY + 20);
        if (ultraNarrow) {
            ctx.fillText(`Energy ${Math.round(metrics.totalEnergy)}`, L.leftX, statsStartY + 36);
        } else {
            ctx.fillText(`Energy ${Math.round(metrics.totalEnergy)}`, Math.min(L.leftX + Math.round(200 * compactScale), L.controlsLeft - Math.round(100 * compactScale)), statsStartY + 20);
        }

        const metricYOffset = ultraNarrow ? 16 : 0;
        const metricBlockTop = statsStartY + metricYOffset;

        ctx.font = tempFont;
        ctx.fillStyle = "#f2f6ff";
        ctx.fillText(`${metrics.averageTempC.toFixed(1)} C`, L.leftX, metricBlockTop + 44);
        ctx.font = bodyFont;
        ctx.fillStyle = "#cdd7e5";
        ctx.fillText("Batch Temp", L.leftX, metricBlockTop + 59);

        const rorColor = metrics.rorCPerMin >= 0 ? "#ffb347" : "#8dc7ff";
        ctx.fillStyle = rorColor;
        ctx.font = rorFont;
        ctx.fillText(`${metrics.rorCPerMin.toFixed(1)} C/min`, L.leftX + Math.round(130 * compactScale), metricBlockTop + 44);
        ctx.font = bodyFont;
        ctx.fillStyle = "#cdd7e5";
        ctx.fillText("RoR", L.leftX + Math.round(130 * compactScale), metricBlockTop + 59);

        const stageLabelX = Math.min(L.leftX + Math.round(220 * compactScale), L.controlsLeft - Math.round(120 * compactScale));
        ctx.fillStyle = "#e6edf8";
        ctx.fillText(`Stage: ${metrics.dominantStageLabel}`, stageLabelX, metricBlockTop + 44);
        ctx.fillText(`Consistency: ${(metrics.consistency * 100).toFixed(1)}%`, stageLabelX, metricBlockTop + 59);

        ctx.fillStyle = "#dbe2ec";
        ctx.fillText(`Avg Colour ${metrics.averageColor}`, L.leftX, metricBlockTop + 78);

        this.drawStageDistribution(metrics, L.leftX, metricBlockTop + 88, L.stageBarWidth, 12, beanCount);
        const stageSummary = this.config.roastStages.map((stage) => `${stage.label.split(" ")[0]} ${metrics.stageCounts[stage.key]}`).join("  ");
        ctx.fillStyle = "#b9c4d5";
        ctx.fillText(stageSummary, L.leftX, metricBlockTop + 114);

        if (L.mode === "mobile") {
            this.drawColorDistribution(metrics, L.graphX, metricBlockTop + 126, L.graphWidth, this.config.hud.graphHeight);
            this.drawEnergyCurve(metrics, L.graphX, metricBlockTop + 186, L.graphWidth, this.config.hud.graphHeight);
        } else {
            const graphTop = L.mode === "tablet" ? (statsStartY + 74) : (L.topY + 22);
            this.drawColorDistribution(metrics, L.graphX, graphTop, L.graphWidth, this.config.hud.graphHeight);
            this.drawEnergyCurve(metrics, L.graphX, graphTop + 62, L.graphWidth, this.config.hud.graphHeight);
        }

        this.drawHudButton(L.makeBeanRect, "Make bean", isMakeBeanPressed);
    }

    drawHudButton(rect, label, isPressed = false) {
        const ctx = this.ctx;
        const buttonScale = clamp(rect.width / 140, 0.84, 1);
        ctx.fillStyle = isPressed ? "#a06f24" : "#7b5821";
        ctx.strokeStyle = isPressed ? "#c79343" : "#9a7233";
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(14 * buttonScale)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, rect.x + (rect.width / 2), rect.y + (rect.height / 2));
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
    }

    drawStageDistribution(metrics, x, y, width, height, totalBeans) {
        const ctx = this.ctx;
        ctx.fillStyle = "rgba(14,18,24,0.78)";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.strokeRect(x, y, width, height);
        if (totalBeans <= 0) return;

        const stageColors = { drying: "#d9e86a", maillard: "#ebb84a", firstCrack: "#d58a2f", development: "#9f5b2e", secondCrack: "#4b2f23" };
        const presentStages = this.config.roastStages.filter((stage) => (metrics.stageCounts[stage.key] || 0) > 0);
        if (presentStages.length === 0) return;

        let cursorX = Math.round(x);
        const rightEdge = Math.round(x + width);
        presentStages.forEach((stage, index) => {
            const count = metrics.stageCounts[stage.key] || 0;
            let segWidth = Math.round((count / totalBeans) * width);
            if (index === presentStages.length - 1) {
                segWidth = Math.max(0, rightEdge - cursorX);
            }
            if (segWidth <= 0) return;
            ctx.fillStyle = stageColors[stage.key] || "#999999";
            ctx.fillRect(cursorX, Math.round(y), segWidth, Math.round(height));
            cursorX += segWidth;
        });
    }

    drawColorDistribution(metrics, x, y, width, height) {
        const ctx = this.ctx;
        const bins = metrics.distribution;
        const maxCount = Math.max(1, ...bins);
        const gap = 4;
        const visibleBins = bins
            .map((count, i) => ({ count, i }))
            .filter((entry) => entry.count > 0);
        const barWidth = (width - ((bins.length - 1) * gap)) / bins.length;
        ctx.fillStyle = "rgba(14,18,24,0.88)";
        ctx.fillRect(x, y, width, height);
        visibleBins.forEach((entry) => {
            const i = entry.i;
            const count = entry.count;
            const barHeight = Math.round((count / maxCount) * Math.round(height - 4));
            if (barHeight <= 0) return;
            const startIdx = Math.floor((i / bins.length) * this.config.roastColors.length);
            const endIdx = Math.max(startIdx, Math.floor(((i + 1) / bins.length) * this.config.roastColors.length) - 1);
            const midIdx = Math.floor((startIdx + endIdx) / 2);
            const barX = Math.round(x + i * (barWidth + gap));
            const barY = Math.round(y + height - barHeight);
            const drawWidth = Math.max(0, Math.round(barWidth));
            if (drawWidth <= 0) return;
            ctx.fillStyle = metrics.distributionColors?.[i] || this.config.roastColors[clamp(midIdx, 0, this.config.roastColors.length - 1)];
            ctx.fillRect(barX, barY, drawWidth, barHeight);
        });
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(x, y, width, height);
    }

    drawEnergyCurve(metrics, x, y, width, height) {
        const ctx = this.ctx;
        const history = metrics.energyHistory;
        ctx.fillStyle = "rgba(14,18,24,0.88)";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(x, y, width, height);
        if (history.length < 2) return;

        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = Math.max(1, max - min);
        ctx.beginPath();
        history.forEach((value, index) => {
            const px = x + (index / (history.length - 1)) * width;
            const py = y + height - (((value - min) / range) * (height - 4)) - 2;
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = "#ffad33";
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
