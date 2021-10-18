import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { ConsistentTimeline, ContisistentTimelineEntry, StateClock, StateType } from "co-nsistent"
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
                        timeOffset={Math.floor(Math.random() * 2000)}
                        receiveObservable={subject.pipe(
                            filter((e) => e.clientId !== clientId),
                            delay(500 + Math.random() * 500)
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
    stateTime: number
}

function reduce(events: Array<Event>, event: Event): Array<Event> {
    return [...events, event]
}

type State = {
    value: number
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
    //TODO: use offset
    const [events, addEventToList] = useReducer(reduce, [])
    const [consistentTimeline, setConsistentTimeline] = useState<Array<ContisistentTimelineEntry<State>>>([])
    const [result, setResult] = useState(0)
    const timeline = useMemo(
        () => {
            const clock = new StateClock(timeOffset, () => new Date().getTime() + timeOffset)
            const ref: State = { value: 0 }
            const baseHistory: Array<ContisistentTimelineEntry<State>> = [{
                reduce: () => {
                    throw "can't reduce the first state"
                },
                state: {
                    value: 0
                },
                stateTime: 0
            }]
            const timeline = new ConsistentTimeline<State>(baseHistory, () => { }, () => ({ value: 0 }), clock, 2000, () => {
                timeline.applyCurrentState(ref)
                setResult(ref.value)
                setConsistentTimeline(timeline.history)
            })
            return timeline
        },
        [setResult, timeOffset, setConsistentTimeline]
    )
    const addEvent = useCallback(
        (event: Event) => {
            addEventToList(event)
            timeline.insert(
                event.stateTime,
                event.type === "*2" ?
                    (ref) => ref.value *= 2 :
                    (ref) => ref.value += 2
            )
        },
        [addEventToList, timeline]
    )
    const createLocalEvent = useCallback(
        (type: "*2" | "+2") => {
            const event: Event = {
                clientId,
                stateTime: timeline.getCurrentTime(),
                type
            }
            addEvent(event)
            sendSubject.next(event)
        },
        [clientId, timeline, sendSubject, addEvent]
    )
    useEffect(() => {
        const subscription = receiveObservable.subscribe(addEvent)
        return () => subscription.unsubscribe()
    }, [addEvent, clientId])
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
            {events.map(({ clientId, stateTime, type }, i) => (
                <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                    <span>{type}</span>
                    <span>Client Id: {clientId}</span>
                    <span>State Time: {stateTime}</span>
                </div>
            ))}
            <h2>Established Timeline</h2>
            {consistentTimeline.map(({ state, stateTime }, i) => {
                return <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                    <span>state: {state.value}</span>
                    <span>Client Id: {clientId}</span>
                    <span>State Time: {stateTime}</span>
                </div>
            })}
            <h2>Result: {result}</h2>
        </div>
    )
}