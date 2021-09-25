import { VectorClock, compareVectorClocksAbsolutely, VectorClockRelation, compareVectorClocks, ExtensiveVectorClockRelation } from "."

export class VectorizedTimeline<T> {
    private presenceEntry: VectorizedTimelineEntry<T>
    private lastEntry: VectorizedTimelineEntry<T>

    constructor(
        presence: T,
        originTimestamp: number,
        localTimestamp: number,
        clock: VectorClock,
        clientId: string,
        private historyDuration: number,
        private onChange: (presence: T, presenceEntry: VectorizedTimelineEntry<T>) => void
    ) {
        this.presenceEntry = {
            clientId,
            originTimestamp,
            localTimestamp,
            clock,
            state: Object.freeze(presence),
            action: () => {
                throw "beginning time step can't be executed"
            },
            futureHistoryEntry: undefined,
            pastHistoryEntry: undefined,
        }
        this.lastEntry = this.presenceEntry
    }

    private removeOldElements(localTimestamp: number): void {
        while(this.lastEntry.futureHistoryEntry != null) {
            if(localTimestamp - this.lastEntry.futureHistoryEntry.localTimestamp < this.historyDuration) {
                return
            }
            this.lastEntry = this.lastEntry.futureHistoryEntry
            this.lastEntry.pastHistoryEntry = undefined
        }
    }

    add(clock: VectorClock, clientId: string, originTimestamp: number, action: (prev: T) => T, localTimestamp: number = new Date().getTime()): void {
        this.removeOldElements(localTimestamp)
        //find place to insert
        let searchEntry: VectorizedTimelineEntry<T> = this.presenceEntry
        let lastRelation: ExtensiveVectorClockRelation
        while (
            (lastRelation = compareVectorClocksAbsolutely(
                searchEntry.clientId,
                searchEntry.clock,
                searchEntry.originTimestamp,
                clientId,
                clock,
                originTimestamp
            )).absolute === VectorClockRelation.AFTER
        ) {
            if (searchEntry.pastHistoryEntry == null) {
                //timeline does not contain old enough entries. can't add the action at the beginning of a timeline
                console.error(`Possible client inconsistency: event to old to insert: `, clock, clientId, localTimestamp, action, `current timeline starts with: `, searchEntry, ` we can't insert an event before the current start`)
                return
            }
            searchEntry = searchEntry.pastHistoryEntry
        }
        if (
            lastRelation.partial === VectorClockRelation.EQUAL || //searchEntry and insert events are the same
            lastRelation.partial === VectorClockRelation.AFTER //the searchEntry event has happend after the insert event => as out of order delivery is impossible this event must already be included in the current state
        ) {
            //duplicate vector clock found
            return
        }

        //insert
        const entryFuture = searchEntry.futureHistoryEntry
        const entry: VectorizedTimelineEntry<T> = {
            localTimestamp,
            clientId,
            originTimestamp,
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
    originTimestamp: number
    localTimestamp: number
    action: (prev: T) => T
    futureHistoryEntry: VectorizedTimelineEntry<T> | undefined
    pastHistoryEntry: VectorizedTimelineEntry<T> | undefined
}
