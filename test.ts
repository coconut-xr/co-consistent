import { expect } from "chai"
import { Clock } from "./src/clock"

describe("clock", () => {
    it("combination of jump, setVelocity and setChange and using wait in between", async () => {
        const clock = new Clock(0, () => now(), 2)
        await expectWait(clock, 1000, 500)
        clock.change(-200, 0.5)
        await expectWait(clock, 600, 400)
        await expectWait(clock, 100, 50)
        clock.change(100, 0.5)
        await expectWait(clock, 1100, 500)
        clock.change(100, 0.1)
        await expectWait(clock, 1050, 500)
        clock.change(0)
        clock.setVelocity(0.5)
        await expectWait(clock, 250, 500)
        clock.change(100, 0.5)
        await expectWait(clock, 350, 500)
        clock.change(100, 0.5)
        await expectWait(clock, 100, 50 + clock.getRestChange())
        clock.jump(100)
        await expectWait(clock, 100, 100)
        await expectWait(clock, 50, 100)
        await expectWait(clock, 50, 100)
        expect(clock.getVelocity()).to.equal(0.5)
        clock.setVelocity(1)
        await expectWait(clock, 100, 100)
        let executed = false
        expectWait(clock, 100, 100).then(() => (executed = true))
        clock.destroy()
        await wait(200)
        expect(executed, "wait callback should not be called after the clock is destroyed").to.be.false
    }).timeout(5000)

    it("throw when trying to set wrong configurations that make the time go backwards", () => {
        const clock = new Clock(0, () => now())
        expect(() => clock.change(-1, 1.2)).to.throw()
        expect(() => clock.jump(-1)).to.throw()
        expect(() => clock.setVelocity(-1)).to.throw()
    })

    it("use setVelocity, change and jump while waiting", async () => {
        let realTimePassed: number = undefined as any
        let stateTimePassed: number = undefined as any
        const clock = new Clock(0, () => now())
        const realTimeStart = now()
        const stateTimeStart = clock.getCurrentTime()
        clock.wait(1000).then(() => {
            realTimePassed = now() - realTimeStart
            stateTimePassed = clock.getCurrentTime() - stateTimeStart
        })
        let currentTime = clock.getCurrentTime()
        await wait(100)
        currentTime = clock.getCurrentTime() - currentTime
        expectDelta(
            currentTime,
            100,
            10,
            `comparing state time (${currentTime}) with expected state time (${100})`,
            true
        )
        clock.setVelocity(2)
        currentTime = clock.getCurrentTime()
        await wait(100)
        currentTime = clock.getCurrentTime() - currentTime
        expectDelta(
            currentTime,
            200,
            20,
            `comparing state time (${currentTime}) with expected state time (${200})`,
            true
        )
        clock.change(100, 0.5)
        currentTime = clock.getCurrentTime()
        await wait(100)
        currentTime = clock.getCurrentTime() - currentTime
        expectDelta(
            currentTime,
            250,
            25,
            `comparing state time (${currentTime}) with expected state time (${350})`,
            true
        )
        clock.setVelocity(0.5)
        const restChange = clock.getRestChange()
        currentTime = clock.getCurrentTime()
        await wait(200)
        currentTime = clock.getCurrentTime() - currentTime
        expectDelta(
            currentTime,
            100 + restChange,
            15,
            `comparing state time (${currentTime}) with expected state time (${100 + restChange})`,
            true
        )
        clock.setVelocity(1)
        currentTime = clock.getCurrentTime()
        clock.jump(200)
        await wait(100)
        currentTime = clock.getCurrentTime() - currentTime
        expectDelta(
            currentTime,
            300,
            30,
            `comparing state time (${currentTime}) with expected state time (${300})`,
            true
        )
        await wait(500)
        expectDelta(
            realTimePassed,
            800,
            30,
            `comparing real time passed (${realTimePassed}) with expected time passed (${800})`,
            false
        )
        expectDelta(
            stateTimePassed,
            1000,
            30,
            `comparing state time passed (${stateTimePassed}) with expected time passed (${1000})`,
            true
        )
    }).timeout(5000)
})

async function wait(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, time))
}

async function expectWait(clock: Clock, waitTillStateTime: number, expectedRealTimeToWait: number): Promise<void> {
    const realStartTime = now()
    const stateTimeStart = clock.getCurrentTime()
    await clock.wait(waitTillStateTime)
    const realTimeWaitTime = now() - realStartTime
    const stateTimeWaitTime = clock.getCurrentTime() - stateTimeStart
    expectDelta(
        realTimeWaitTime,
        expectedRealTimeToWait,
        expectedRealTimeToWait * 0.1 * clock.getVelocity() + 20,
        `comparing real wait time (${realTimeWaitTime}) with expected wait time (${expectedRealTimeToWait})`,
        false
    ) //max 1% off
    expectDelta(
        stateTimeWaitTime,
        waitTillStateTime,
        waitTillStateTime * 0.1 * clock.getVelocity() + 20,
        `comparing state wait time (${stateTimeWaitTime}) with expected state wait time (${waitTillStateTime})`,
        true
    ) //max 1% off
}

function expectDelta(
    greater: number,
    smaller: number,
    delta: number,
    message: string,
    greaterMustBeGreater: boolean
): void {
    expect(Math.abs(greater - smaller), message).to.lessThan(delta)
    if (greaterMustBeGreater) {
        expect(greater).to.be.greaterThan(smaller)
    }
}

function now() {
    const [seconds, nanoseconds] = process.hrtime()
    return 1000 * seconds + nanoseconds / 1000000
}
