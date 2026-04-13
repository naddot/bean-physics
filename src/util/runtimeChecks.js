export class RuntimeChecks {
    constructor(config, roastModel) {
        this.config = config;
        this.roastModel = roastModel;
        this.lastLogAtByKey = new Map();
    }

    runRoastModelChecks() {
        const cases = [0, 250, 1000, 50000, 300000, 1001000];
        for (let i = 1; i < cases.length; i += 1) {
            const prevTemp = this.roastModel.getTemperatureCFromForce(cases[i - 1]);
            const nextTemp = this.roastModel.getTemperatureCFromForce(cases[i]);
            if (nextTemp < prevTemp) {
                this.warnThrottled("roast-temp-monotonic", `Temperature is not monotonic: ${prevTemp.toFixed(2)}C -> ${nextTemp.toFixed(2)}C`);
            }
        }

        const minTemp = this.roastModel.getTemperatureCFromForce(0);
        if (minTemp < (this.config.temperature.ambientC - 0.01)) {
            this.warnThrottled("roast-temp-min", `Temperature below ambient: ${minTemp.toFixed(2)}C`);
        }
    }

    runAnalyticsChecks(metrics, beanCount) {
        if (!metrics) return;

        if (!Array.isArray(metrics.distribution) || metrics.distribution.length !== this.config.analytics.histogramBins) {
            this.warnThrottled("analytics-distribution-shape", "Distribution bins shape mismatch.");
        }

        const distSum = (metrics.distribution || []).reduce((sum, n) => sum + n, 0);
        if (Math.abs(distSum - beanCount) > 1) {
            this.warnThrottled("analytics-distribution-sum", `Distribution sum ${distSum} != beanCount ${beanCount}`);
        }

        if (typeof metrics.consistency !== "number" || metrics.consistency < 0 || metrics.consistency > 1) {
            this.warnThrottled("analytics-consistency-range", `Consistency out of range: ${metrics.consistency}`);
        }

        const temp = metrics.averageTempC;
        if (typeof temp !== "number" || Number.isNaN(temp)) {
            this.warnThrottled("analytics-temp-nan", "Average temperature is NaN/invalid.");
        } else if (temp < (this.config.temperature.ambientC - 5) || temp > (this.config.temperature.maxRoastC + 20)) {
            this.warnThrottled("analytics-temp-range", `Average temperature suspicious: ${temp.toFixed(2)}C`);
        }

        if (!Array.isArray(metrics.energyHistory) || !Array.isArray(metrics.tempHistory)) {
            this.warnThrottled("analytics-history-shape", "History arrays missing.");
        } else {
            if (metrics.energyHistory.length > this.config.analytics.maxHistoryPoints) {
                this.warnThrottled("analytics-energy-history-limit", `Energy history exceeded max points: ${metrics.energyHistory.length}`);
            }
            if (metrics.tempHistory.length > this.config.analytics.maxHistoryPoints) {
                this.warnThrottled("analytics-temp-history-limit", `Temp history exceeded max points: ${metrics.tempHistory.length}`);
            }
        }
    }

    warnThrottled(key, message) {
        if (!this.config.runtimeChecks?.enabled) return;
        const now = Date.now();
        const last = this.lastLogAtByKey.get(key) || 0;
        if ((now - last) < this.config.runtimeChecks.logIntervalMs) return;
        this.lastLogAtByKey.set(key, now);
        console.warn(`[RuntimeCheck] ${message}`);
    }
}
