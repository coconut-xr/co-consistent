import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { Clock, Universe, HistoryEntry } from "co-consistent"
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
    x: number
    y: number
}

type Action = {
    type: "x++" | "y++" | "init"
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
    const clock = useMemo(() => new Clock(timeOffset, () => global.window == null ? 0 :window.performance.now()), [timeOffset])
    const universe = useMemo(() => {
        const ref: State = { x: 0, y: 0 }
        const universe = new Universe<State, Action>(
            (base, deltaTime, action, cachedDeltaTime, cachedBase, cachedResult) => {
                if (action?.type === "init" || base == null) {
                    return
                }
                if (action == null) {
                    cachedResult.x = base.x
                    cachedResult.y = base.y
                    return
                }
                if (base.x !== cachedBase?.x) {
                    cachedResult.x = action.type === "x++" ? base.x + 1 : base.x
                }
                if (base.y !== cachedBase?.y) {
                    cachedResult.y = action.type === "y++" ? base.y + 1 : base.y
                }
            },
            (a1, a2) => a1.id - a2.id,
            (from, to) => {
                to.x = from.x
                to.y = from.y
            },
            2000,
            () => {
                universe.applyCurrentState(ref, clock.getCurrentTime())
                setHistory([...universe.history])
                setX(ref.x)
                setY(ref.y)
            }
        )
        universe.insert(
            {
                id: Math.random(),
                type: "init",
            },
            clock.getCurrentTime(),
            0,
            {
                x: 0,
                y: 0,
            }
        )
        universe.applyCurrentState(ref, clock.getCurrentTime())
        setX(ref.x)
        setY(ref.y)
        return universe
    }, [clock, setX, setY, timeOffset, setHistory])
    const addEvent = useCallback(
        (event: Event) => {
            addEventToList(event)
            let currentTime = clock.getCurrentTime()
            if(event.time > currentTime) {
                clock.jump(event.time - currentTime)
                currentTime = clock.getCurrentTime()
            }
            universe.insert(event.action, currentTime, event.time)
        },
        [addEventToList, universe, clock]
    )
    const createLocalEvent = useCallback(
        (actionType: "x++" | "y++") => {
            const event: Event = {
                clientId,
                time: clock.getCurrentTime(),
                action: {
                    type: actionType,
                    id: Math.random(),
                },
            }
            addEvent(event)
            sendSubject.next(event)
        },
        [clientId, clock, sendSubject, addEvent]
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
            {history.map(({ time, result }, i) => {
                return (
                    <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                        <span>
                            result: x: {result.x}, y: {result.y}
                        </span>
                        <span>State Time: {time}</span>
                    </div>
                )
            })}
            <h2>X: {x}</h2>
            <h2>Y: {y}</h2>
        </div>
    )
}
