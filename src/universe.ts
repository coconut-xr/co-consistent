import { State } from "."

type GetAction<S extends State<unknown>> = S extends State<infer A> ? A : never

export class Universe<S extends State<unknown>> {
    public readonly history: Array<HistoryEntry<S, GetAction<S>>> = []

    private readonly baseHelper1: S
    private readonly baseHelper2: S

    constructor(
        private readonly createStore: () => S,
        private readonly compareAction: (a1: GetAction<S>, a2: GetAction<S>) => number,
        private readonly historyDuration: number,
        private readonly onChange?: () => void
    ) {
        this.baseHelper1 = createStore()
        this.baseHelper2 = createStore()
    }

    private removeOldElements(currentTime: number): void {
        let i = 0
        while (i < this.history.length - 1 && currentTime - this.history[i + 1].time > this.historyDuration) {
            i++
        }
        this.history.splice(0, i)
    }

    /**
     * @returns false if the action is already included in the history
     */
    insert(action: GetAction<S>, currentTime: number, time?: number, result?: S): boolean {
        this.removeOldElements(currentTime)

        if (time == null) {
            time = currentTime
        } else if (time > currentTime) {
            throw `time (${time}) can't be bigger then current time (${currentTime}) (maybe jump the clock forwards?)`
        }
        let indexToInsertAfter = this.findEntryIndexBefore(time, action)
        if (indexToInsertAfter === -1) {
            return false
        }
        let base: S | undefined
        let deltaTime = 0
        if (indexToInsertAfter === -2) {
            if (result == null) {
                throw `unable to insert action at time: ${time} (too old)`
            }
            indexToInsertAfter = -1
        } else {
            const prevEntry = this.history[indexToInsertAfter]
            base = prevEntry.result
            deltaTime = time - prevEntry.time
        }

        if (result == null) {
            result = this.createStore()
            result.update(base, deltaTime, action, undefined, undefined)
        }

        this.history.splice(indexToInsertAfter + 1, 0, {
            action,
            time,
            result,
            deltaTime,
        })
        this.recalculateAfter(indexToInsertAfter + 1, this.history[indexToInsertAfter]?.result)
        return true
    }

    private recalculateAfter(index: number, oldPrevResult?: S): void {
        if (index < this.history.length - 1) {
            const prevEntry = this.history[index]
            const currentEntry = this.history[index + 1]
            const deltaTime = currentEntry.time - prevEntry.time
            const nextOldPrevResult = this.baseHelper1 === oldPrevResult ? this.baseHelper2 : this.baseHelper1
            nextOldPrevResult.copyFrom(currentEntry.result)
            currentEntry.result.update(
                prevEntry.result,
                deltaTime,
                currentEntry.action,
                currentEntry.deltaTime,
                oldPrevResult
            )
            this.recalculateAfter(index + 1, nextOldPrevResult)
        } else {
            this.onChange && this.onChange()
        }
    }

    /**
     * @returns the index (>0); -1 when the action is already in the history; -2 when the action is too old to insert
     */
    private findEntryIndexBefore(time: number, action?: GetAction<S>): number {
        for (let i = this.history.length - 1; i >= 0; i--) {
            const historyEntry = this.history[i]
            if (historyEntry.time <= time) {
                if (historyEntry.time === time && action != null) {
                    const actionComparison = this.compareAction(historyEntry.action, action)
                    if (actionComparison > 0) {
                        continue
                    } else if (actionComparison === 0) {
                        return -1
                    }
                }
                return i
            }
        }
        return -2
    }

    public applyStateAt(store: S, historyEntry: HistoryEntry<S, GetAction<S>>, time: number): void {
        if (time < historyEntry.time) {
            throw "can't extrapolate state into the past"
        }
        store.update(historyEntry.result, time - historyEntry.time, undefined, undefined, undefined)
    }

    applyCurrentState(store: S, currentTime: number): void {
        this.applyStateAt(store, this.history[this.history.length - 1], currentTime)
    }
}

export type HistoryEntry<S, A> = {
    time: number
    action: A
    result: S
    deltaTime: number
}
