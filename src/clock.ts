export type WaitEntry = {
    callback: () => void
    waitTime: number
    startTime: number
    timeoutRef: NodeJS.Timeout
}

export class Clock {
    private realTimeAtStateTime: number
    private changePeriodRealTime = 0
    private changePerRealTime = 0

    private readonly waitSet: Set<WaitEntry> = new Set()

    constructor(private stateTime: number, private readonly getRealTime: () => number, private stateTimeVelocity = 1) {
        this.realTimeAtStateTime = this.getRealTime()
    }

    private getRealTimePassed(realTime: number): number {
        return realTime - this.realTimeAtStateTime
    }

    private getPassedChangePeriod(realTimePassed: number): number {
        return Math.min(this.changePeriodRealTime, realTimePassed)
    }

    private computeStateTime(timePassed: number, passedRealTimeChangePeriod: number): number {
        return (
            this.stateTime + timePassed * this.stateTimeVelocity + passedRealTimeChangePeriod * this.changePerRealTime
        )
    }

    private beforeChange(realTimePassed: number): void {
        const passedRealTimeChangePeriod = this.getPassedChangePeriod(realTimePassed)
        this.stateTime = this.computeStateTime(realTimePassed, passedRealTimeChangePeriod)
        this.waitSet.forEach((entry) => {
            entry.waitTime -= this.stateTime - entry.startTime
            entry.startTime = this.stateTime
        })
        this.changePeriodRealTime -= passedRealTimeChangePeriod
        this.realTimeAtStateTime += realTimePassed
    }

    private afterChange(): void {
        this.waitSet.forEach((entry) => {
            clearTimeout(entry.timeoutRef)
            entry.timeoutRef = this.createWaitTimeout(entry.callback, entry.waitTime)
        })
    }

    private createWaitTimeout(callback: WaitEntry["callback"], waitTime: WaitEntry["waitTime"]): NodeJS.Timeout {
        return setTimeout(callback, Math.max(0, this.calculateRealTimeLeftTo(waitTime)))
    }

    private calculateRealTimeLeftTo(waitTime: number): number {
        const velocityWithChange = this.stateTimeVelocity + this.changePerRealTime
        const stateTimeAfterChangePeriod = velocityWithChange * this.changePeriodRealTime
        let result: number
        if (waitTime > stateTimeAfterChangePeriod) {
            const stateTimeLeftAfterChangePeriodEnd = waitTime - stateTimeAfterChangePeriod
            result = this.changePeriodRealTime + stateTimeLeftAfterChangePeriodEnd / this.stateTimeVelocity
        } else {
            result = waitTime / velocityWithChange
        }
        console.log("calculateRealTimeLeftTo", waitTime, result)
        return result
    }

    /**
     * executes a time change by offset over time
     * can be used to make negative changes over time
     */
    change(offset: number, changeRate = 0.1): void {
        if (changeRate > 1 && offset < 0) {
            throw new Error(
                "changeRate should no be over 1 when the offset is negative. We can't go backwards in time."
            )
        }
        const realTimePassed = this.getRealTimePassed(this.getRealTime())
        this.beforeChange(realTimePassed)
        this.changePerRealTime = offset < 0 ? -Math.abs(changeRate) : Math.abs(changeRate)
        this.changePeriodRealTime = offset / this.changePerRealTime
        this.afterChange()
    }

    getRestChange(): number {
        const passedRealTimeChangePeriod = this.getPassedChangePeriod(this.getRealTimePassed(this.getRealTime()))
        return (this.changePeriodRealTime - passedRealTimeChangePeriod) * this.changePerRealTime
    }

    /**
     * @param time reffering to the clock's time
     */
    wait(time: number): Promise<void> {
        return new Promise((resolve) => {
            this.beforeChange(this.getRealTimePassed(this.getRealTime()))
            const callback = () => {
                this.waitSet.delete(entry)
                resolve()
            }
            const entry: WaitEntry = {
                timeoutRef: this.createWaitTimeout(callback, time),
                callback,
                waitTime: time,
                startTime: this.getCurrentTime(),
            }
            this.waitSet.add(entry)
        })
    }

    getCurrentTime(): number {
        const realTimePassed = this.getRealTimePassed(this.getRealTime())
        return this.computeStateTime(realTimePassed, this.getPassedChangePeriod(realTimePassed))
    }

    /**
     * executes an instant time jump
     * can only be use to make forward jumps
     * @param by cannot be negative
     */
    jump(by: number): void {
        if (by < 0) {
            throw "can't jump backwards in state time"
        }
        const timePassed = this.getRealTimePassed(this.getRealTime())
        this.beforeChange(timePassed)
        this.stateTime += by
        this.afterChange()
    }

    setVelocity(velocity: number): void {
        if (velocity < 0) {
            throw new Error("velocity can't be negative")
        }
        const realTimePassed = this.getRealTimePassed(this.getRealTime())
        this.beforeChange(realTimePassed)
        this.stateTimeVelocity = velocity
        this.afterChange()
    }

    getVelocity(): number {
        return this.stateTimeVelocity
    }

    destroy(): void {
        this.waitSet.forEach((entry) => {
            clearTimeout(entry.timeoutRef)
        })
    }
}
