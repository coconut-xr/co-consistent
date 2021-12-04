import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { Universe, HistoryEntry, Clock, State } from "co-consistent"
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

class ValueState implements State<Action> {
    constructor(public value: number) {}

    update(
        base: this | undefined,
        deltaTime: number,
        action: Action | undefined,
        prevDeltaTime: number | undefined,
        prevBase: this | undefined
    ): void {
        if (base == null || action?.type === "init") {
            return
        }
        if (action == null) {
            this.value = base.value
            return
        }
        if (base.value !== prevBase?.value) {
            if (action.type === "*2") {
                this.value = base.value * 2
            } else {
                this.value = base.value + 2
            }
        }
    }
    copyFrom(ref: this): void {
        this.value = ref.value
    }
}

type Action = {
    type: "+2" | "*2" | "init"
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
    const [history, setHistory] = useState<Array<HistoryEntry<ValueState, Action>>>([])
    const [result, setResult] = useState(0)
    const clock = useMemo(
        () => new Clock(timeOffset, () => (global.window == null ? 0 : window.performance.now())),
        [timeOffset]
    )
    const universe = useMemo(() => {
        const ref = new ValueState(0)
        const universe = new Universe(
            () => new ValueState(0),
            (a1, a2) => a1.id - a2.id,
            2000,
            () => {
                universe.applyCurrentState(ref, clock.getCurrentTime())
                setHistory([...universe.history])
                setResult(ref.value)
            }
        )
        universe.insert(
            {
                id: Math.random(),
                type: "init",
            },
            clock.getCurrentTime(),
            0,
            new ValueState(0)
        )
        universe.applyCurrentState(ref, clock.getCurrentTime())
        setResult(ref.value)
        return universe
    }, [setResult, timeOffset, setHistory, clock])
    const addEvent = useCallback(
        (event: Event) => {
            addEventToList(event)
            universe.insert(event.action, event.time)
        },
        [addEventToList, universe]
    )
    const createLocalEvent = useCallback(
        (actionType: "*2" | "+2") => {
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
        [clock, clientId, universe, sendSubject, addEvent]
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
            {events.map(({ clientId, time, action }, i) => (
                <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                    <span>{action.type}</span>
                    <span>action id: {action.id}</span>
                    <span>Client Id: {clientId}</span>
                    <span>State Time: {time}</span>
                </div>
            ))}
            <h2>Established History</h2>
            {history.map(({ result, time, action }, i) => {
                return (
                    <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                        <span>{action.type}</span>
                        <span>action id: {action.id}</span>
                        <span>result: {result.value}</span>
                        <span>State Time: {time}</span>
                    </div>
                )
            })}
            <h2>Result: {result}</h2>
        </div>
    )
}
