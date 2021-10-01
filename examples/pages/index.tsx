import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import {
    VectorClock,
    vectorClockIncrease,
    vectorClockMax,
    VectorizedTimeline,
    VectorizedTimelineEntry,
    vectorizedTimelineEntryToArray
} from "co-vectorize"
import { Observable, Subject } from "rxjs"
import { delay, filter } from "rxjs/operators"

export default function Index() {
    const subject = useMemo(() => new Subject<Event>(), [])
    const clients = useMemo(
        () =>
            new Array(5).fill(null).map((_, i) => {
                const clientId = `#${i}`
                return (
                    <Client
                        key={i}
                        clientId={clientId}
                        timeOffset={Math.floor(Math.random() * 2000 - 500)}
                        receiveObservable={subject.pipe(
                            filter((e) => e.clientId !== clientId),
                            delay(1000 + Math.random() * 1000)
                        )}
                        sendSubject={subject}
                    />
                )
            }),
        [subject]
    )
    return (
        <div style={{ fontFamily: "arial", display: "flex", flexDirection: "row", justifyContent: "space-around" }}>
            {clients}
        </div>
    )
}

type Event = {
    type: "+2" | "*2"
    clientId: string
    timestamp: number
    clock: VectorClock
}

function reduce(events: Array<Event>, event: Event): Array<Event> {
    return [...events, event]
}

export function Client({
    timeOffset,
    clientId,
    sendSubject,
    receiveObservable,
}: {
    timeOffset: number
    clientId: string
    sendSubject: Subject<Event>
    receiveObservable: Observable<Event>
}) {
    const clock = useMemo<VectorClock>(() => ({}), [])
    const [events, addEventToList] = useReducer(reduce, [])
    const [vectorizedTimeline, setVectorizedTimeline] = useState<Array<VectorizedTimelineEntry<number>>>([])
    const [result, setResult] = useState(0)
    const timeline = useMemo(
        () =>
            new VectorizedTimeline<number>(0, 0, new Date().getTime(), {}, "server", 4000, (result, entry) => {
                setResult(result)
                setVectorizedTimeline(vectorizedTimelineEntryToArray(entry))
            }),
        [setResult, setVectorizedTimeline]
    )
    const addEvent = useCallback(
        (event: Event) => {
            addEventToList(event)
            timeline.add(
                event.clock,
                event.clientId,
                event.timestamp,
                event.type === "*2" ? (v) => v * 2 : (v) => v + 2
            )
        },
        [addEventToList, timeline]
    )
    const createLocalEvent = useCallback(
        (type: "*2" | "+2") => {
            //local event
            vectorClockIncrease(clock, clientId, 1)
            const event = {
                clientId,
                clock: { ...clock },
                timestamp: new Date().getTime() + timeOffset,
                type,
            }
            //send event
            vectorClockIncrease(clock, clientId, 1)
            addEvent(event)
            sendSubject.next(event)
        },
        [clock, clientId, timeline, sendSubject, addEvent]
    )
    useEffect(() => {
        const subscription = receiveObservable.subscribe((event) => {
            //max events
            vectorClockMax(clock, event.clock)
            //receive event
            vectorClockIncrease(clock, clientId, 1)
            addEvent(event)
        })
        return () => subscription.unsubscribe()
    }, [addEvent, clientId, clock])
    return (
        <div style={{ flexBasis: 0, flexGrow: 1, margin: "3rem" }}>
            <h1>Client {clientId}</h1>
            <span>Time Offset: {timeOffset}</span>
            <br />
            <br />
            <button style={{ padding: "1rem", marginRight: "1rem" }} onClick={() => createLocalEvent("+2")}>
                +2
            </button>
            <button style={{ padding: "1rem" }} onClick={() => createLocalEvent("*2")}>
                *2
            </button>
            <h2>Events in received order</h2>
            {events.map(({ clientId, clock, timestamp, type }, i) => (
                <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                    <span>{type}</span>
                    <span>Clock: {JSON.stringify(clock)}</span>
                    <span>Client Id: {clientId}</span>
                    <span>Timestamp: {<Timestamp value={timestamp} />}</span>
                </div>
            ))}
            <h2>Established Timeline</h2>
            {vectorizedTimeline.map(({ clientId, action, clock, state, originTimestamp, localTimestamp }, i) => (
                <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                    <span>{action.toString()}</span>
                    <span>{state}</span>
                    <span>Clock: {JSON.stringify(clock)}</span>
                    <span>Client Id: {clientId}</span>
                    <span>
                        Origin Timestamp: <Timestamp value={originTimestamp} />
                    </span>
                    <span>
                        Local Timestamp: <Timestamp value={localTimestamp} />
                    </span>
                </div>
            ))}
            <h2>Result: {result}</h2>
        </div>
    )
}

function Timestamp({ value }: { value: number }) {
    return (
        <span>
            {useMemo(() => {
                const date = new Date(value)
                return `${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`
            }, [value])}
        </span>
    )
}
