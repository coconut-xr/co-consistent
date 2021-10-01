export type ContinousTimelineObserver<S> = { globalTime: number, onChange: (state: S) => void }

export class ContinousTimeline<S> {

    public currentEntry: ContinousTimelineEntry<S>
    private lastEntry: ContinousTimelineEntry<S>
    private observers: Array<ContinousTimelineObserver<S>> = []

    constructor(
        state: ContinousState<S>,
        globalTime: number,
        private readonly isOld: (globalTime: number) => boolean,
        private readonly onChange: (presenceEntry: ContinousTimelineEntry<S>) => void
    ) {
        this.currentEntry = {
            globalTime,
            next: undefined,
            prev: undefined,
            reducer: () => {
                throw "beginning time step can't be executed"
            },
            state
        }
        this.lastEntry = this.currentEntry
    }

    private removeOldElements(): void {
        while (this.lastEntry.next != null) {
            if (!this.isOld(this.lastEntry.next.globalTime)) {
                return
            }
            this.lastEntry = this.lastEntry.next
            this.lastEntry.prev = undefined
        }
        let i = 0
        while (
            i < this.observers.length &&
            this.observers[i].globalTime < this.lastEntry.globalTime
        ) {
            i++
        }
        this.observers.splice(0, i)
    }

    insert(globalTime: number, reducer: (state: S) => ContinousState<S>): () => void {
        this.removeOldElements()

        let prev: ContinousTimelineEntry<S> | undefined = this.currentEntry
        while (prev != null) {
            if (prev.globalTime === globalTime) {
                throw `two event can not happen at the same time (${globalTime})`
            }
            if (prev.globalTime < globalTime) {
                break
            }
            prev = prev.prev
        }
        if (prev == null) {
            throw `event too old to insert (${globalTime})`
        }
        const next = prev.next
        const entry: ContinousTimelineEntry<S> = {
            globalTime,
            next,
            prev,
            reducer,
            state: reducer(getStateAt(globalTime, prev.state))
        }

        prev.next = entry

        if (next != null) {
            next.prev = entry
        } else {
            this.currentEntry = entry
        }

        this.reclculate(globalTime, prev)
        return () => {
            if (this.lastEntry == entry || entry.prev == null) {
                throw "can't remove last entry"
            }
            if (entry.next != null) {
                entry.next.prev = entry.prev
            } else {
                this.currentEntry = entry.prev
            }
            entry.prev.next = entry.next
            this.reclculate(globalTime, entry.prev)
        }
    }

    private reclculate(globalTime: number, from: ContinousTimelineEntry<S>): void {
        let current = from
        let index = this.observers.findIndex(observer => globalTime <= observer.globalTime)
        while (current.next != null) {
            current.next.state = current.next.reducer(getStateAt(current.next.globalTime, current.state))
            while (
                index >= 0 && //required case findIndex can ouput -1
                index < this.observers.length &&
                this.observers[index].globalTime >= current.globalTime &&
                this.observers[index].globalTime < current.next.globalTime
            ) {
                const observer = this.observers[index]
                observer.onChange(getStateAt(observer.globalTime, current.state))
                index++
            }
            current = current.next
        }
        this.onChange(current)
    }

    observeAt(globalTime: number, onChange: (state: S) => void): () => void {
        const observer: ContinousTimelineObserver<S> = {
            globalTime,
            onChange
        }
        const index = this.observers.findIndex((observer) => globalTime <= observer.globalTime)
        this.observers.splice(index, 0, observer)
        return () => {
            const index = this.observers.findIndex((o) => observer === o)
            this.observers.splice(index, 1)
        }
    }

}

export function continousTimelineEntryToArray<T>(entry: ContinousTimelineEntry<T>): Array<ContinousTimelineEntry<T>> {
    const result: Array<ContinousTimelineEntry<T>> = []
    let current: ContinousTimelineEntry<T> | undefined = entry
    while (current != null) {
        result.unshift(current)
        current = current.prev
    }
    return result
}

export type ContinousTimelineEntry<S> = {
    state: ContinousState<S>,
    globalTime: number,
    reducer: (state: S) => ContinousState<S>
    next: ContinousTimelineEntry<S> | undefined
    prev: ContinousTimelineEntry<S> | undefined
}

export enum StateType {
    CONTINOUS,
    STATIC
}

export type ContinousState<S> = {
    type: StateType.STATIC
    value: S
} | {
    type: StateType.CONTINOUS
    value: ((globalTime: number) => S)
}

export function getStateAt<S>(globalTime: number, state: ContinousState<S>): S {
    return state.type === StateType.CONTINOUS ? state.value(globalTime) : state.value
}