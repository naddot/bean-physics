export class FirstCrackPopTrigger {
    trigger(beanManager, firstCrackAudio, nowMs) {
        const roastModel = beanManager.roastModel;
        if (!roastModel) return;
        beanManager.forEach((bean) => {
            if (bean.hasFirstCrackPopped) return;
            const tempC = roastModel.getTemperatureCFromForce(bean.totalForce);
            const stage = roastModel.getRoastStageForTemp(tempC);
            if (stage.key !== "firstCrack") return;
            bean.hasFirstCrackPopped = true;
            firstCrackAudio?.playPop(nowMs);
        });
    }
}
