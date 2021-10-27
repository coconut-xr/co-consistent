import { StateClock } from "."

export class Universe<S, A> {

    
    public readonly history: Array<HistoryEntry<S, A>> = []

    constructor(
        private readonly createState: () => S,
        private readonly applyAction: (ref: S, action: A) => void,
        private readonly checkActionDependencyChange: (cur: S, prev: S, action: A) => boolean,
        private readonly applyExtrapolatedState: (ref: S, state: S, time: number) => void,
        /**
         * deterministic comparison to sort actions (return 0 when action is equal)
         */
        private readonly compareAction: (a1: A, a2: A) => number,
        private readonly clock: StateClock,
        private readonly historyDuration: number,
        private readonly onChange?: () => void
    ) {}

    applyCurrentState(ref: S): void {
        const time = this.clock.getCurrentTime()
        const current = this.history[this.history.length - 1]
        this.applyStateAt(ref, current.state, current.stateTime, time)
    }

    private removeOldElements(currentTime: number): void {
        let i = 0
        while (i < this.history.length - 1 && currentTime - this.history[i + 1].stateTime > this.historyDuration) {
            i++
        }
        this.history.splice(0, i)
    }

    getCurrentTime(): number {
        return this.clock.getCurrentTime()
    }

    insertState(): void {

    }

    /**
     * @returns 'false' if the action is already contained (stateTime equal & compareAction function returns 0)
     */
    insertAction(stateTime: number, action: A): boolean {
        const currentTime = this.clock.getCurrentTime()
        this.removeOldElements(currentTime)

        for (let i = this.history.length - 1; i >= 0; i--) {
            const prev = this.history[i]
            let comparison = prev.stateTime - stateTime
            if (comparison === 0) {
                comparison = this.compareAction(prev.action, action)
                if (comparison === 0) {
                    return false
                }
            }
            if (comparison < 0) {
                if (currentTime < stateTime) {
                    this.clock.jump(stateTime - currentTime)
                }
                const entry: HistoryEntry<S, A> = {
                    stateTime,
                    action,
                    state: this.createBaseState(prev.state, prev.stateTime, stateTime, action),
                }
                this.history.splice(i + 1, 0, entry)
                this.reclculate(i + 1)
                return true
            }
        }
        throw `event too old to insert (try to insert at: ${stateTime}, current time: ${currentTime})`
    }

    private insertEntry(): void {
        
    }

    /**
     *
     * @param stateTime
     * @param fromIndex the index of the entry after which potential changes can happen
     */
    private reclculate(fromIndex: number): void {
        let prevState: S = this.history[fromIndex - 1].state
        for (let i = fromIndex + 1; i < this.history.length; i++) {
            const prev = this.history[i - 1]
            const current = this.history[i]
            const currentActionDependencyChanged = this.checkActionDependencyChange(
                prev.state,
                prevState,
                current.action
            )
            prevState = current.state
            if (currentActionDependencyChanged) {
                current.state = this.createBaseState(prev.state, prev.stateTime, current.stateTime, current.action)
            }
        }
        this.onChange && this.onChange()
    }

    private createBaseState(prevState: S, prevStateTime: number, baseStateTime: number, action: A): S {
        const result = this.createState()
        this.applyStateAt(result, prevState, prevStateTime, baseStateTime)
        this.applyAction(result, action)
        return result
    }

    applyStateAt(ref: S, state: S, stateStateTime: number, currentStateTime: number): void {
        if (currentStateTime < stateStateTime) {
            throw "can't extrapolate an state into the past"
        }
        this.applyExtrapolatedState(ref, state, currentStateTime - stateStateTime)
    }
}

export type HistoryEntry<S, A> = {
    state: S
    stateTime: number
    action: A
}
