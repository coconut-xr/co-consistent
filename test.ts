import { expect } from "chai"
import { Clock } from "./src/clock"

describe("clock", () => {
    it("different velocities", async () => {
        const c1 = new Clock(0, () => now())
        const c2 = new Clock(0, () => now(), 2)
        c1.change(100, 0.5)
        c2.change(200, 0.5)
        await wait(500)
        c1.jump(100)
        c2.jump(200)
        await wait(500)
        const c1Time = c1.getCurrentTime()
        const c2Time = c2.getCurrentTime()
        expect(Math.abs(c1Time * 2 - c2Time)).lessThan(2)
    })

    it("throw when trying to set wrong configurations that make the time go backwards", () => {
        const clock = new Clock(0, () => now())
        expect(() => clock.change(-1, 1.2)).to.throw()
        expect(() => clock.jump(-1)).to.throw()
        expect(() => clock.setVelocity(-1)).to.throw()
    })

    it("different jump", async () => {
        const c1 = new Clock(0, () => now(), 1.5)
        const c2 = new Clock(0, () => now(), 1.5)
        c1.change(200, 0.5)
        c2.change(200, 0.5)
        await wait(500)
        c1.setVelocity(2)
        c2.setVelocity(2)
        c1.jump(100)
        c2.jump(500)
        await wait(500)
        const c1Time = c1.getCurrentTime()
        const c2Time = c2.getCurrentTime()
        expect(Math.abs(c1Time + 400 - c2Time)).lessThan(2)
    })

    it("wait & destroy", async () => {
        const c1 = new Clock(0, () => now())
        let called = false
        c1.wait(10).then(() => called = true)
        await wait(100)
        expect(called).to.be.true
        called = false
        c1.wait(10).then(() => called = true)
        c1.destroy()
        await wait(100)
        expect(called).to.be.false
        expect(c1.getVelocity()).to.eq(1)
    })

    it("different change", async () => {
        const c1 = new Clock(0, () => now(), 1.5)
        const c2 = new Clock(0, () => now(), 1.5)
        c1.change(100, 0.5)
        c2.change(500, 0.5)
        await wait(100)
        c1.setVelocity(2)
        c2.setVelocity(2)
        c1.jump(100)
        c2.jump(100)
        await wait(400)
        c1.jump(100)
        c2.jump(100)
        await wait(500)
        const c1Time = c1.getCurrentTime()
        const c2Time = c2.getCurrentTime()
        expect(Math.abs(c1Time + 400 - c2Time)).lessThan(2)
    })

    it("wait", async () => {
        const c = new Clock(0, () => now(), 0.5)
        c.change(1000)
        wait(500).then(() => {
            c.setVelocity(1)
            c.change(-200, 0.5)
            c.jump(100)
        })
        const start = c.getCurrentTime()
        await c.wait(700)
        const delta = c.getCurrentTime() - start
        expect(delta).greaterThan(700)
    })
})

async function wait(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, time))
}

function now() {
    const [seconds, nanoseconds] = process.hrtime()
    return 1000 * seconds + nanoseconds / 1000000
}
