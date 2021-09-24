import { VectorClock, compareVectorClocksAbsolutely, VectorClockRelation, compareVectorClocks } from "."

export class VectorizedTimeline<T> {
    private presenceEntry: VectorizedTimelineEntry<T>

    constructor(
        presence: T,
        timestamp: number,
        clock: VectorClock,
        clientId: string,
        private historyDuration: number,
        private onChange: (presence: T, presenceEntry: VectorizedTimelineEntry<T>) => void
    ) {
        this.presenceEntry = {
            clientId,
            timestamp,
            clock,
            state: Object.freeze(presence),
            action: () => {
                throw "beginning time step can't be executed"
            },
            futureHistoryEntry: undefined,
            pastHistoryEntry: undefined,
        }
    }

    private removeOldElements(currentTimestamp: number) {
        let future = this.presenceEntry
        let current = this.presenceEntry.pastHistoryEntry
        while (current != null) {
            if (currentTimestamp - current.timestamp > this.historyDuration) {
                current.pastHistoryEntry = undefined
                return
            }
            future = current
            current = current.pastHistoryEntry
        }
    }

    add(clock: VectorClock, clientId: string, timestamp: number, action: (prev: T) => T, currentTimestamp: number = new Date().getTime()): void {
        //find place to insert
        let searchEntry: VectorizedTimelineEntry<T> = this.presenceEntry
        let lastRelation: VectorClockRelation | undefined
        while (
            searchEntry != null &&
            (lastRelation = compareVectorClocksAbsolutely(
                searchEntry.clientId,
                searchEntry.clock,
                searchEntry.timestamp,
                clientId,
                clock,
                timestamp
            )) === VectorClockRelation.AFTER
        ) {
            if (searchEntry.pastHistoryEntry == null) {
                //timeline does not contain old enough entries. can't add the action at the beginning of a timeline
                console.warn(`event to old to insert: `, clock, clientId, timestamp, action, `current timeline starts with: `, searchEntry, ` we can't insert an event before the current start`)
                return
            }
            searchEntry = searchEntry.pastHistoryEntry
        }
        if (lastRelation === VectorClockRelation.EQUAL) {
            //duplicate vector clock found
            return
        }

        //insert
        const entryFuture = searchEntry.futureHistoryEntry
        const entry: VectorizedTimelineEntry<T> = {
            clientId,
            timestamp,
            action,
            clock,
            futureHistoryEntry: entryFuture,
            pastHistoryEntry: searchEntry,
            state: Object.freeze(action(searchEntry.state)),
        }
        searchEntry.futureHistoryEntry = entry
        if (entryFuture != null) {
            entryFuture.pastHistoryEntry = entry
        }

        //set new head
        if (searchEntry === this.presenceEntry) {
            this.presenceEntry = entry
        }

        //recalculate follow up values
        let current: VectorizedTimelineEntry<T> | undefined = entryFuture
        while (current != null) {
            current.state = Object.freeze(current.action(current.pastHistoryEntry!.state))
            current = current.futureHistoryEntry
        }

        this.removeOldElements(currentTimestamp)
        this.onChange(this.presenceEntry.state, this.presenceEntry)
    }
}

export function entryToArray<T>(entry: VectorizedTimelineEntry<T>): Array<VectorizedTimelineEntry<T>> {
    const result: Array<VectorizedTimelineEntry<T>> = []
    let current: VectorizedTimelineEntry<T> | undefined = entry
    while (current != null) {
        result.unshift(current)
        current = current.pastHistoryEntry
    }
    return result
}

export type VectorizedTimelineEntry<T> = {
    clientId: string
    state: T
    clock: VectorClock
    timestamp: number
    action: (prev: T) => T
    futureHistoryEntry: VectorizedTimelineEntry<T> | undefined
    pastHistoryEntry: VectorizedTimelineEntry<T> | undefined
}
