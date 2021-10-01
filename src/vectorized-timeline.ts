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
            next: undefined,
            prev: undefined,
        }
        this.lastEntry = this.presenceEntry
    }

    private removeOldElements(localTimestamp: number): void {
        while(this.lastEntry.next != null) {
            if(localTimestamp - this.lastEntry.next.localTimestamp < this.historyDuration) {
                return
            }
            this.lastEntry = this.lastEntry.next
            this.lastEntry.prev = undefined
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
            if (searchEntry.prev == null) {
                //timeline does not contain old enough entries. can't add the action at the beginning of a timeline
                console.error(`Possible client inconsistency: event to old to insert: `, clock, clientId, localTimestamp, action, `current timeline starts with: `, searchEntry, ` we can't insert an event before the current start`)
                return
            }
            searchEntry = searchEntry.prev
        }
        if (
            lastRelation.partial === VectorClockRelation.EQUAL || //searchEntry and insert events are the same
            lastRelation.partial === VectorClockRelation.AFTER //the searchEntry event has happend after the insert event => as out of order delivery is impossible this event must already be included in the current state
        ) {
            //duplicate vector clock found
            return
        }

        //insert
        const next = searchEntry.next
        const entry: VectorizedTimelineEntry<T> = {
            localTimestamp,
            clientId,
            originTimestamp,
            action,
            clock,
            next: next,
            prev: searchEntry,
            state: Object.freeze(action(searchEntry.state)),
        }
        searchEntry.next = entry
        if (next != null) {
            next.prev = entry
        }

        //set new head
        if (searchEntry === this.presenceEntry) {
            this.presenceEntry = entry
        }

        //recalculate follow up values
        let current: VectorizedTimelineEntry<T> | undefined = next
        while (current != null) {
            current.state = Object.freeze(current.action(current.prev!.state))
            current = current.next
        }

        this.onChange(this.presenceEntry.state, this.presenceEntry)
    }
}

export function vectorizedTimelineEntryToArray<T>(entry: VectorizedTimelineEntry<T>): Array<VectorizedTimelineEntry<T>> {
    const result: Array<VectorizedTimelineEntry<T>> = []
    let current: VectorizedTimelineEntry<T> | undefined = entry
    while (current != null) {
        result.unshift(current)
        current = current.prev
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
    next: VectorizedTimelineEntry<T> | undefined
    prev: VectorizedTimelineEntry<T> | undefined
}
