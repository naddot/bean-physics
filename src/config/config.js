export const CONFIG = {
    runtimeChecks: { enabled: true, logIntervalMs: 3000 },
    physics: { gravityY: 0.9, positionIterations: 8, velocityIterations: 6, constraintIterations: 2, wallThickness: 80 },
    bean: {
        radius: 16,
        restitution: 0.28,
        friction: 0.12,
        frictionAir: 0.02,
        density: 0.0024,
        initialVelocityX: 4.5,
        initialVelocityY: 4.2,
        roastPhysics: {
            enabled: true,
            maxExpansionScale: 1.07,
            minDensityFactor: 0.88,
            minRestitutionFactor: 0.8,
            maxFrictionAirFactor: 1.15,
            interpolation: 0.2,
            minScaleDelta: 0.002,
            minDensityDelta: 0.00001
        },
        energyTransfer: {
            enabled: true,
            radius: 40,
            ratePerSecond: 0.12,
            maxPerPairPerSecond: 220
        }
    },
    spawn: { intervalMs: 90 },
    mouse: {
        influenceRadius: 120,
        dragBoostPerPixel: 0.11,
        maxDragBoost: 2.8,
        forceScale: 0.0045,
        velocityForceScale: 0.00024,
        paddle: {
            enabled: true,
            lifeMs: 950,
            expandMs: 170,
            maxRadius: 132,
            startRadius: 10,
            bladeCount: 4,
            bladeArcWidthRad: 0.58,
            bladeThickness: 22,
            angularSpeedRadPerSec: 4.8,
            tangentialForceScale: 0.0056,
            radialForceScale: 0.002,
            scoopVelocityBase: 8.5,
            scoopVelocityBoost: 9.5,
            maxBeanSpeed: 18
        }
    },
    motion: {
        tiltForceScale: 0.00024,
        tiltRateForceScale: 0.0011,
        shakeThreshold: 32,
        shakeCooldownMs: 1000,
        shakeForceScale: 0.055,
        gravityWhenFlat: 0.035,
        gravityWhenUpright: 0.5,
        uprightBoostExponent: 1.55,
        tiltRateSmoothing: 0.9,
        accelSmoothing: 0.88,
        tiltStrengthSmoothing: 0.86,
        gravitySmoothing: 0.9
    },
    analytics: { histogramBins: 8, sampleIntervalMs: 250, maxHistoryPoints: 180, energyImpactScale: 40, rorLookbackMs: 15000 },
    temperature: { ambientC: 20, maxRoastC: 248, curveGamma: 1.0 },
    roastStages: [
        { key: "drying", label: "Drying", minC: 100, maxC: 160 },
        { key: "maillard", label: "Maillard", minC: 160, maxC: 196 },
        { key: "firstCrack", label: "First Crack", minC: 196, maxC: 205 },
        { key: "development", label: "Development", minC: 205, maxC: 224 },
        { key: "secondCrack", label: "Second Crack", minC: 224, maxC: 260 }
    ],
    roastThresholds: [800, 1800, 3200, 5500, 9000, 14000, 21000, 30000, 42000, 58000, 76000, 96000, 118000, 142000, 168000, 196000, 226000, 258000, 300000],
    roastColors: [
        "#d9f9a2",
        "#e5f6a3",
        "#f0f2a1",
        "#f5e88e",
        "#efd672",
        "#e6c35f",
        "#d9ad4e",
        "#cc9644",
        "#bf833e",
        "#b17338",
        "#a26534",
        "#965a31",
        "#8b522f",
        "#804a2d",
        "#74422a",
        "#673a27",
        "#5a3224",
        "#4d2b21",
        "#41231c",
        "#321a16",
        "#24120f",
        "#130b08",
        "#070403"
    ],
    startingColors: ["#5cff82", "#67e083", "#5cbd73", "#73bd5c", "#98ed7e", "#b2ed7e", "#c3fa93", "#c7e87b", "#e6fc8d", "#8dfcb0"],
    hud: { headerX: 10, headerY: 10, headerHeight: 166, margin: 12, graphHeight: 52, controlsReserveWidth: 300, buttonWidth: 152, buttonHeight: 38, buttonGap: 10 },
    draw: { beanBaseRadius: 12 }
};

export const BEAN_SHAPE_PATH = "M19.151 4.868a6.744 6.744 0 00-5.96-1.69 12.009 12.009 0 00-6.54 3.47 11.988 11.988 0 00-3.48 6.55 6.744 6.744 0 001.69 5.95 6.406 6.406 0 004.63 1.78 11.511 11.511 0 007.87-3.56C21.3 13.428 22.1 7.818 19.151 4.868Z";
export const BEAN_DETAIL_PATH = "M19.151,4.868a6.744,6.744,0,0,0-5.96-1.69,12.009,12.009,0,0,0-6.54,3.47,11.988,11.988,0,0,0-3.48,6.55,6.744,6.744,0,0,0,1.69,5.95,6.406,6.406,0,0,0,4.63,1.78,11.511,11.511,0,0,0,7.87-3.56C21.3,13.428,22.1,7.818,19.151,4.868Zm-14.99,8.48a11.041,11.041,0,0,1,3.19-5.99,10.976,10.976,0,0,1,5.99-3.19,8.016,8.016,0,0,1,1.18-.09,5.412,5.412,0,0,1,3.92,1.49.689.689,0,0,1,.11.13,6.542,6.542,0,0,1-2.12,1.23,7.666,7.666,0,0,0-2.96,1.93,7.666,7.666,0,0,0-1.93,2.96,6.589,6.589,0,0,1-1.71,2.63,6.7,6.7,0,0,1-2.63,1.71,7.478,7.478,0,0,0-2.35,1.36A6.18,6.18,0,0,1,4.161,13.348Zm12.49,3.31c-3.55,3.55-8.52,4.35-11.08,1.79a1.538,1.538,0,0,1-.12-.13,6.677,6.677,0,0,1,2.13-1.23,7.862,7.862,0,0,0,2.96-1.93,7.738,7.738,0,0,0,1.93-2.96,6.589,6.589,0,0,1,1.71-2.63,6.589,6.589,0,0,1,2.63-1.71,7.6,7.6,0,0,0,2.34-1.37C20.791,9.2,19.821,13.488,16.651,16.658Z";
