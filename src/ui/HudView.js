import { formatDuration } from "../util/time.js";
import { clamp } from "../util/color.js";
import { BEAN_DETAIL_PATH, BEAN_SHAPE_PATH } from "../config/config.js";

export class HudView {
    constructor(config, ctx, hudLayout) {
        this.config = config;
        this.ctx = ctx;
        this.hudLayout = hudLayout;
        this.buttonRects = { makeBean: null, debug: null };
        this.shapePath = new Path2D(BEAN_SHAPE_PATH);
        this.detailPath = new Path2D(BEAN_DETAIL_PATH);
    }

    getButtonRects() {
        return this.buttonRects;
    }

    drawBean(bean, debugEnabled) {
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
        if (debugEnabled) {
            ctx.beginPath();
            ctx.arc(base, base, base, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255,0,0,0.35)";
            ctx.stroke();
        }
        ctx.restore();
    }

    draw(metrics, beanCount, debugEnabled, canvasWidth) {
        const ctx = this.ctx;
        const L = this.hudLayout.compute(canvasWidth);
        this.buttonRects.makeBean = L.makeBeanRect;
        this.buttonRects.debug = L.debugRect;

        ctx.fillStyle = "rgba(14,18,24,0.86)";
        ctx.fillRect(L.headerX, L.headerY, L.headerWidth, L.headerHeight);
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.strokeRect(L.headerX, L.headerY, L.headerWidth, L.headerHeight);

        ctx.fillStyle = "#e8edf5";
        ctx.font = "bold 14px Arial";
        ctx.fillText("Roasting Console", L.leftX, L.topY);

        ctx.fillStyle = "#dbe2ec";
        ctx.font = "12px Arial";
        ctx.fillText(`Time ${formatDuration(metrics.elapsedRoastMs)}`, L.leftX, L.topY + 20);
        ctx.fillText(`Beans ${beanCount}`, L.leftX + 110, L.topY + 20);
        ctx.fillText(`Energy ${Math.round(metrics.totalEnergy)}`, Math.min(L.leftX + 200, L.controlsLeft - 100), L.topY + 20);

        ctx.font = "bold 18px Arial";
        ctx.fillStyle = "#f2f6ff";
        ctx.fillText(`${metrics.averageTempC.toFixed(1)} C`, L.leftX, L.topY + 44);
        ctx.font = "12px Arial";
        ctx.fillStyle = "#cdd7e5";
        ctx.fillText("Batch Temp", L.leftX, L.topY + 59);

        const rorColor = metrics.rorCPerMin >= 0 ? "#ffb347" : "#8dc7ff";
        ctx.fillStyle = rorColor;
        ctx.font = "bold 16px Arial";
        ctx.fillText(`${metrics.rorCPerMin.toFixed(1)} C/min`, L.leftX + 130, L.topY + 44);
        ctx.font = "12px Arial";
        ctx.fillStyle = "#cdd7e5";
        ctx.fillText("RoR", L.leftX + 130, L.topY + 59);

        const stageLabelX = Math.min(L.leftX + 220, L.controlsLeft - 120);
        ctx.fillStyle = "#e6edf8";
        ctx.fillText(`Stage: ${metrics.dominantStageLabel}`, stageLabelX, L.topY + 44);
        ctx.fillText(`Consistency: ${(metrics.consistency * 100).toFixed(1)}%`, stageLabelX, L.topY + 59);

        ctx.fillStyle = metrics.averageColor;
        ctx.fillRect(L.leftX, L.topY + 68, 20, 12);
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.strokeRect(L.leftX, L.topY + 68, 20, 12);
        ctx.fillStyle = "#dbe2ec";
        ctx.fillText(`Avg Colour ${metrics.averageColor}`, L.leftX + 26, L.topY + 78);

        this.drawStageDistribution(metrics, L.leftX, L.topY + 88, L.stageBarWidth, 12, beanCount);
        const stageSummary = this.config.roastStages.map((stage) => `${stage.label.split(" ")[0]} ${metrics.stageCounts[stage.key]}`).join("  ");
        ctx.fillStyle = "#b9c4d5";
        ctx.fillText(stageSummary, L.leftX, L.topY + 114);

        this.drawColorDistribution(metrics, L.graphX, L.topY + 22, L.graphWidth, this.config.hud.graphHeight);
        this.drawEnergyCurve(metrics, L.graphX, L.topY + 84, L.graphWidth, this.config.hud.graphHeight);

        this.drawHudButton(L.makeBeanRect, "Make bean", "primary", debugEnabled);
        this.drawHudButton(L.debugRect, debugEnabled ? "Debug: ON" : "Debug: OFF", "secondary", debugEnabled);
    }

    drawHudButton(rect, label, mode, debugEnabled) {
        const ctx = this.ctx;
        if (mode === "primary") {
            ctx.fillStyle = "#7b5821";
            ctx.strokeStyle = "#9a7233";
        } else {
            ctx.fillStyle = debugEnabled ? "#1f5a3d" : "#333333";
            ctx.strokeStyle = debugEnabled ? "#2f7e58" : "#575757";
        }
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, rect.x + (rect.width / 2), rect.y + (rect.height / 2));
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
    }

    drawStageDistribution(metrics, x, y, width, height, totalBeans) {
        const ctx = this.ctx;
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.strokeRect(x, y, width, height);
        if (totalBeans <= 0) return;

        const stageColors = { drying: "#d9e86a", maillard: "#ebb84a", firstCrack: "#d58a2f", development: "#9f5b2e", secondCrack: "#4b2f23" };
        let cursorX = x;
        this.config.roastStages.forEach((stage) => {
            const count = metrics.stageCounts[stage.key] || 0;
            if (count <= 0) return;
            const segWidth = (count / totalBeans) * width;
            ctx.fillStyle = stageColors[stage.key] || "#999999";
            ctx.fillRect(cursorX, y, segWidth, height);
            cursorX += segWidth;
        });
    }

    drawColorDistribution(metrics, x, y, width, height) {
        const ctx = this.ctx;
        const bins = metrics.distribution;
        const maxCount = Math.max(1, ...bins);
        const gap = 4;
        const barWidth = (width - ((bins.length - 1) * gap)) / bins.length;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(x, y, width, height);
        bins.forEach((count, i) => {
            if (count <= 0) return;
            const barHeight = Math.round((count / maxCount) * (height - 4));
            if (barHeight <= 0) return;
            const startIdx = Math.floor((i / bins.length) * this.config.roastColors.length);
            const endIdx = Math.max(startIdx, Math.floor(((i + 1) / bins.length) * this.config.roastColors.length) - 1);
            const midIdx = Math.floor((startIdx + endIdx) / 2);
            ctx.fillStyle = this.config.roastColors[clamp(midIdx, 0, this.config.roastColors.length - 1)];
            ctx.fillRect(x + i * (barWidth + gap), y + height - barHeight, barWidth, barHeight);
        });
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.strokeRect(x, y, width, height);
    }

    drawEnergyCurve(metrics, x, y, width, height) {
        const ctx = this.ctx;
        const history = metrics.energyHistory;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
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
