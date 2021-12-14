import { expect } from "chai"
import { Clock } from "./src/clock"

describe("clock", () => {
    it("different velocities", async () => {
        const clock = new Clock(0, () => now(), 2) // *2
        const endMeasure = startMeasure()
        clock.change(100, 0.5) //+100
        await wait(500)
        clock.jump(100) //+100
        await wait(500)
        const time = clock.getCurrentTime()
        const realDelta = endMeasure()
        expect(Math.abs(time - realDelta * 2 - 200)).lessThan(2)
    })

    it("throw when trying to set wrong configurations that make the time go backwards", () => {
        const clock = new Clock(0, () => now())
        expect(() => clock.change(-1, 1.2)).to.throw()
        expect(() => clock.jump(-1)).to.throw()
        expect(() => clock.setVelocity(-1)).to.throw()
    })

    it("different jump", async () => {
        let delta = 0
        const clock = new Clock(0, () => now(), 1.5)
        let endMeasure = startMeasure()
        clock.change(200, 0.5) //+200
        await wait(500)
        delta += endMeasure() * 1.5
        endMeasure = startMeasure()
        clock.setVelocity(2)
        clock.jump(100) //+100
        await wait(500)
        delta += endMeasure() * 2
        const time = clock.getCurrentTime()
        expect(Math.abs(time - delta - 300)).lessThan(2)
    })

    it("wait & destroy", async () => {
        const clock = new Clock(0, () => now())
        let called = false
        clock.wait(10).then(() => (called = true))
        await wait(100)
        expect(called).to.be.true
        called = false
        clock.wait(10).then(() => (called = true))
        clock.destroy()
        await wait(100)
        expect(called).to.be.false
        expect(clock.getVelocity()).to.eq(1)
    })

    it("different change", async () => {
        let delta = 0
        const clock = new Clock(0, () => now(), 1.5) //*1.5
        let endMeasure = startMeasure()
        clock.change(100, 0.5) //+100
        await wait(100)
        delta += endMeasure() * 1.5
        endMeasure = startMeasure()
        clock.setVelocity(2) //*2
        clock.jump(100) //+100
        await wait(400)
        delta += endMeasure() * 2
        endMeasure = startMeasure()
        clock.jump(100) //+100
        await wait(500)
        delta += endMeasure() * 2
        endMeasure = startMeasure()
        const time = clock.getCurrentTime()
        expect(Math.abs(time - delta - 300)).lessThan(2)
    })

    it("wait", async () => {
        let delta = 0
        const clock = new Clock(0, () => now(), 0.5) //* 0.5
        let endMeasure = startMeasure()
        clock.change(1000) //* 0.6
        wait(500).then(() => {
            delta += endMeasure() * 0.6
            endMeasure = startMeasure()
            clock.setVelocity(1) //*1
            clock.change(-200, 0.9) //-200
            clock.jump(100) //+100
        })
        await clock.wait(1000)
        delta += endMeasure() * 1
        const time = clock.getCurrentTime()
        expect(time).greaterThan(1000).and.lessThan(1020)
        expect(Math.abs(time - delta - -200 - 100)).lessThan(2)
    })
})

function startMeasure(): () => number {
    const start = now()
    return () => now() - start
}

async function wait(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, time))
}

function now() {
    const [seconds, nanoseconds] = process.hrtime()
    return 1000 * seconds + nanoseconds / 1000000
}
