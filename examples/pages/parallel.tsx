import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { StateClock, Universe, HistoryEntry } from "co-consistent"
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
                        timeOffset={Math.floor(Math.random() * 1000)}
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
    action: Action
    clientId: string
    time: number
}

function reduce(events: Array<Event>, event: Event): Array<Event> {
    return [...events, event]
}

type State = {
    x: number,
    y: number
}

type Action = {
    type: "x++" | "y++"
    id: number
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
    const [events, addEventToList] = useReducer(reduce, [])
    const [history, setHistory] = useState<Array<HistoryEntry<State, Action>>>([])
    const [x, setX] = useState(0)
    const [y, setY] = useState(0)
    const universe = useMemo(() => {
        const clock = new StateClock(timeOffset, () => new Date().getTime() + timeOffset)
        const ref: State = { x: 0, y: 0 }
        const baseHistory: Array<HistoryEntry<State, Action>> = [
            {
                action: null as any,
                state: {
                    x: 0,
                    y: 0
                },
                stateTime: 0,
            },
        ]
        const universe = new Universe<State, Action>(
            baseHistory,
            () => ({ x: 0, y: 0 }),
            (ref, action) => (action.type === "x++" ? (ref.x++) : (ref.y++)),
            (cur, prev, action) => action.type === "x++" ? cur.x !== prev.x : cur.y !== prev.y,
            (ref, state) => {
                ref.x = state.x
                ref.y = state.y
            },
            (a1, a2) => a1.id - a2.id,
            clock,
            2000,
            () => {
                universe.applyCurrentState(ref)
                setX(ref.x)
                setY(ref.y)
                setHistory(universe.history)
            }
        )
        return universe
    }, [setX, setY, timeOffset, setHistory])
    const addEvent = useCallback(
        (event: Event) => {
            addEventToList(event)
            universe.insert(event.time, event.action)
        },
        [addEventToList, universe]
    )
    const createLocalEvent = useCallback(
        (actionType: "x++" | "y++") => {
            const event: Event = {
                clientId,
                time: universe.getCurrentTime(),
                action: {
                    type: actionType,
                    id: Math.random(),
                },
            }
            addEvent(event)
            sendSubject.next(event)
        },
        [clientId, universe, sendSubject, addEvent]
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
            <button style={{ padding: "1rem", marginRight: "1rem" }} onClick={() => createLocalEvent("x++")}>
                x++
            </button>
            <button style={{ padding: "1rem" }} onClick={() => createLocalEvent("y++")}>
                y++
            </button>
            <h2>Events in received order</h2>
            {events.map(({ clientId, time, action }, i) => (
                <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                    <span>{action.type}</span>
                    <span>action id: {action.id}</span>
                    <span>Client Id: {clientId}</span>
                    <span>State Time: {time}</span>
                </div>
            ))}
            <h2>Established History</h2>
            {history.map(({ state, stateTime }, i) => {
                return (
                    <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                        <span>state: x: {state.x}, y: {state.y}</span>
                        <span>Client Id: {clientId}</span>
                        <span>State Time: {stateTime}</span>
                    </div>
                )
            })}
            <h2>X: {x}</h2>
            <h2>Y: {y}</h2>
        </div>
    )
}
