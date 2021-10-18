export class StateClock {
    private realTimeAtStateTime: number

    constructor(private stateTime: number, private readonly getRealTime: () => number, private stateTimeVelocity = 1) {
        this.realTimeAtStateTime = this.getRealTime()
    }

    private computeCurrentStateTime(realTime: number): number {
        return this.stateTime + (realTime - this.realTimeAtStateTime) * this.stateTimeVelocity
    }

    getCurrentTime(): number {
        return this.computeCurrentStateTime(this.getRealTime())
    }

    jump(by: number): void {
        if (by < 0) {
            throw "can't jump backwards in state time"
        }
        this.stateTime += by
    }

    setVelocity(velocity: number): void {
        const newRealTime = this.getRealTime()
        this.stateTime = this.computeCurrentStateTime(newRealTime)
        this.realTimeAtStateTime = newRealTime
        this.stateTimeVelocity = velocity
    }

    getVelocity(): number {
        return this.stateTimeVelocity
    }
}
