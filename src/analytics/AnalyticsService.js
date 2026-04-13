export class AnalyticsService {
    constructor(config, roastModel) {
        this.config = config;
        this.roastModel = roastModel;
        this.metrics = this.createInitialMetrics();
    }

    createInitialMetrics() {
        return {
            totalEnergy: 0,
            averageColor: "#000000",
            consistency: 1,
            distribution: Array(this.config.analytics.histogramBins).fill(0),
            averageTempC: this.config.temperature.ambientC,
            dominantStageLabel: "Warm-up",
            stageCounts: Object.fromEntries(this.config.roastStages.map((stage) => [stage.key, 0])),
            roastStartTime: null,
            elapsedRoastMs: 0,
            tempHistory: [],
            rorCPerMin: 0,
            energyHistory: [],
            lastSampleTime: 0
        };
    }

    getMetrics() {
        return this.metrics;
    }

    update(beans, timeStamp) {
        const count = beans.length;
        const bins = Array(this.config.analytics.histogramBins).fill(0);

        if (count === 0) {
            this.metrics.totalEnergy = 0;
            this.metrics.averageColor = "#000000";
            this.metrics.consistency = 1;
            this.metrics.distribution = bins;
            this.metrics.averageTempC = this.config.temperature.ambientC;
            this.metrics.dominantStageLabel = "Warm-up";
            this.metrics.stageCounts = Object.fromEntries(this.config.roastStages.map((stage) => [stage.key, 0]));
            this.metrics.rorCPerMin = 0;
            return;
        }

        let totalEnergy = 0;
        let r = 0;
        let g = 0;
        let b = 0;
        let sum = 0;
        let sumSquares = 0;
        let totalTempC = 0;
        const stageCounts = Object.fromEntries(this.config.roastStages.map((stage) => [stage.key, 0]));
        let warmupCount = 0;

        beans.forEach((bean) => {
            totalEnergy += bean.totalForce;
            const rgb = this.hexToRgb(bean.color);
            r += rgb.r;
            g += rgb.g;
            b += rgb.b;
            sum += bean.colorIndex;
            sumSquares += bean.colorIndex * bean.colorIndex;

            const tempC = this.roastModel.getTemperatureCFromForce(bean.totalForce);
            totalTempC += tempC;
            const stageKey = this.roastModel.getRoastStageForTemp(tempC).key;
            if (stageKey === "warmup") warmupCount += 1;
            else stageCounts[stageKey] += 1;

            const bin = Math.min(
                this.config.analytics.histogramBins - 1,
                Math.floor((bean.colorIndex / Math.max(1, this.config.roastColors.length - 1)) * this.config.analytics.histogramBins)
            );
            bins[bin] += 1;
        });

        const mean = sum / count;
        const stdDev = Math.sqrt(Math.max(0, (sumSquares / count) - (mean * mean)));

        this.metrics.totalEnergy = totalEnergy;
        this.metrics.averageColor = this.rgbToHex(r / count, g / count, b / count);
        this.metrics.consistency = Math.max(0, 1 - (stdDev / Math.max(1, this.config.roastColors.length - 1)));
        this.metrics.distribution = bins;
        this.metrics.averageTempC = totalTempC / count;
        this.metrics.stageCounts = stageCounts;

        if (this.metrics.roastStartTime === null && totalEnergy > 0) {
            this.metrics.roastStartTime = timeStamp;
        }
        this.metrics.elapsedRoastMs = this.metrics.roastStartTime === null ? 0 : Math.max(0, timeStamp - this.metrics.roastStartTime);

        const dominantStage = this.config.roastStages.reduce((best, stage) => {
            if (!best) return stage;
            return stageCounts[stage.key] > stageCounts[best.key] ? stage : best;
        }, null);
        this.metrics.dominantStageLabel = warmupCount > (stageCounts[dominantStage.key] || 0) ? "Warm-up" : dominantStage.label;

        if ((timeStamp - this.metrics.lastSampleTime) >= this.config.analytics.sampleIntervalMs) {
            this.metrics.energyHistory.push(totalEnergy);
            this.metrics.tempHistory.push({ time: timeStamp, tempC: this.metrics.averageTempC });
            this.metrics.lastSampleTime = timeStamp;

            if (this.metrics.energyHistory.length > this.config.analytics.maxHistoryPoints) this.metrics.energyHistory.shift();
            if (this.metrics.tempHistory.length > this.config.analytics.maxHistoryPoints) this.metrics.tempHistory.shift();
        }

        this.metrics.rorCPerMin = this.calculateRoR();
    }

    calculateRoR() {
        if (this.metrics.tempHistory.length < 2) return 0;
        const latest = this.metrics.tempHistory[this.metrics.tempHistory.length - 1];
        let earliest = this.metrics.tempHistory[0];
        for (let i = this.metrics.tempHistory.length - 1; i >= 0; i -= 1) {
            if ((latest.time - this.metrics.tempHistory[i].time) >= this.config.analytics.rorLookbackMs) {
                earliest = this.metrics.tempHistory[i];
                break;
            }
        }
        const dtMin = Math.max(1 / 60000, (latest.time - earliest.time) / 60000);
        return (latest.tempC - earliest.tempC) / dtMin;
    }

    hexToRgb(hex) {
        const value = hex.replace("#", "");
        return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
    }

    rgbToHex(r, g, b) {
        const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
}
