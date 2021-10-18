/**
 * realTime vs. stateTime
 */

import { StateClock } from "."

export type ConsistentTimelineObserver<S> = { stateTime: number; onChange: (setState: (ref: S) => void) => void }

export class ConsistentTimeline<S, A> {
    private observers: Array<ConsistentTimelineObserver<S>> = []

    constructor(
        /**
         * [past, ..., current]
         * [0, ..., n]
         */
        public readonly history: Array<ContisistentTimelineEntry<S, A>>,
        private readonly createState: () => S,
        private readonly applyAction: (ref: S, action: A) => void,
        private readonly applyExtrapolatedState: (ref: S, state: S, time: number) => void,
        private readonly clock: StateClock,
        private readonly historyDuration: number,
        private readonly onChange?: () => void
    ) {}

    applyCurrentState(ref: S): void {
        const time = this.clock.getCurrentTime()
        const current = this.history[this.history.length - 1]
        this.applyStateAt(ref, current.state, current.stateTime, time)
    }

    private cleanObservers(): void {
        let i = 0
        const lastStateTime = this.history.length === 0 ? Infinity : this.history[this.history.length - 1].stateTime
        while (i < this.observers.length && this.observers[i].stateTime < lastStateTime) {
            i++
        }
        this.observers.splice(0, i)
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

    insert(stateTime: number, action: A): () => void {
        const currentTime = this.clock.getCurrentTime()
        this.removeOldElements(currentTime)
        this.cleanObservers()

        for (let i = this.history.length - 1; i >= 0; i--) {
            const prev = this.history[i]
            if (prev.stateTime === stateTime) {
                //TODO: use a second attribute for consistency
                throw `two event can not happen at the same time (${stateTime})`
            }
            if (prev.stateTime < stateTime) {
                if (currentTime < stateTime) {
                    this.clock.jump(stateTime - currentTime)
                }
                const entry: ContisistentTimelineEntry<S, A> = {
                    stateTime,
                    action,
                    state: this.createBaseState(prev.state, prev.stateTime, stateTime, action),
                }
                this.history.splice(i + 1, 0, entry)
                this.reclculate(stateTime, i)
                return () => {
                    const index = this.history.findIndex((e) => e === entry)
                    if (index === -1) {
                        throw "entry not found in the timeline"
                    }
                    if (index === 0) {
                        throw "can't delete last timeline entry"
                    }
                    this.history.splice(index, 1)
                    this.reclculate(stateTime, index - 1)
                }
            }
        }
        throw `event too old to insert (try to insert at: ${stateTime}, current time: ${currentTime})`
    }

    /**
     *
     * @param stateTime
     * @param fromIndex the index of the entry after which potential changes can happen
     */
    private reclculate(stateTime: number, fromIndex: number): void {
        let observerIndex = this.observers.findIndex((observer) => stateTime <= observer.stateTime)
        for (let i = fromIndex + 1; i < this.history.length; i++) {
            const prev = this.history[i - 1]
            const current = this.history[i]
            const next = this.history[i + 1]
            current.state = this.createBaseState(prev.state, prev.stateTime, current.stateTime, current.action)
            while (
                observerIndex >= 0 && //required case findIndex can ouput -1
                observerIndex < this.observers.length &&
                this.observers[observerIndex].stateTime >= current.stateTime &&
                (next == null || this.observers[observerIndex].stateTime < current.stateTime)
            ) {
                const observer = this.observers[observerIndex]
                observer.onChange((ref) => this.applyStateAt(ref, current.state, current.stateTime, observer.stateTime))
                observerIndex++
            }
        }
        this.onChange && this.onChange()
    }

    observeAt(stateTime: number, onChange: (setState: (ref: S) => void) => void): () => void {
        const observer: ConsistentTimelineObserver<S> = {
            stateTime: stateTime,
            onChange,
        }
        const index = this.observers.findIndex((observer) => stateTime <= observer.stateTime)
        this.observers.splice(index, 0, observer)
        return () => {
            const index = this.observers.findIndex((o) => observer === o)
            this.observers.splice(index, 1)
        }
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

export type ContisistentTimelineEntry<S, A> = {
    state: S
    stateTime: number
    action: A
}

export enum StateType {
    CONTINOUS,
    STATIC,
}

export type ExtrapolatedStateApplier<S, C> = (ref: C, state: S, time: number) => void
