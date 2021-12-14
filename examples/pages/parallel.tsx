import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { Clock, Universe, HistoryEntry, State } from "co-consistent"
import { Observable, Subject } from "rxjs"
import { delay, filter } from "rxjs/operators"
import { Header } from "../components/header"
import { Footer } from "../components/footer"
import MD from "../content/parallel.md"

export default function Index() {
    return (
        <div className="d-flex flex-column fullscreen">
            <Header selectedIndex={1} />
            <div className="d-flex flex-column justify-content-stretch container-lg">
                <div className="d-flex flex-row-responsive">
                    <Parallel />
                </div>
                <MD />
                <div className="p-3 flex-basis-0 flex-grow-1"></div>
            </div>
            <Footer />
        </div>
    )
}

function Parallel() {
    const subject = useMemo(() => new Subject<Event>(), [])
    const clients = useMemo(
        () =>
            new Array(4).fill(null).map((_, i) => {
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
        <div
            style={{
                fontFamily: "arial",
                flexWrap: "wrap",
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-around",
            }}>
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

class ParallelState implements State<Action> {
    constructor(public x: number, public y: number) {}

    update(
        base: this | undefined,
        deltaTime: number,
        action: Action | undefined,
        prevDeltaTime: number | undefined,
        prevBase: this | undefined
    ): void {
        if (action?.type === "init" || base == null) {
            return
        }
        if (action == null) {
            this.x = base.x
            this.y = base.y
            return
        }
        if (base.x !== prevBase?.x) {
            this.x = action.type === "x++" ? base.x + 1 : base.x
        }
        if (base.y !== prevBase?.y) {
            this.y = action.type === "y++" ? base.y + 1 : base.y
        }
    }

    copyFrom(ref: this): void {
        this.x = ref.x
        this.y = ref.y
    }
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
    const [history, setHistory] = useState<Array<HistoryEntry<ParallelState, Action>>>([])
    const [x, setX] = useState(0)
    const [y, setY] = useState(0)
    const clock = useMemo(
        () => new Clock(timeOffset, () => (global.window == null ? 0 : window.performance.now())),
        [timeOffset]
    )
    const universe = useMemo(() => {
        const ref = new ParallelState(0, 0)
        const universe = new Universe(
            () => new ParallelState(0, 0),
            (a1, a2) => a1.id - a2.id,
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
            new ParallelState(0, 0)
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
            if (event.time > currentTime) {
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
        <div className="m-3" style={{ flexGrow: 1 }}>
            <h1>Client {clientId}</h1>
            <span>Time Offset: {timeOffset}</span>
            <br />
            <br />
            <button
                className="btn btn-outline-primary"
                style={{ padding: "1rem", marginRight: "1rem" }}
                onClick={() => createLocalEvent("x++")}>
                x++
            </button>
            <button className="btn btn-outline-primary" style={{ padding: "1rem" }} onClick={() => createLocalEvent("y++")}>
                y++
            </button>
            <h2 className="mt-3">X: {x}</h2>
            <h2 className="mb-3">Y: {y}</h2>
            <h2 className="mt-3">Events in received order</h2>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {events.map(({ clientId, time, action }, i) => (
                    <div key={i} style={{ marginBottom: "2rem", display: "flex", flexDirection: "column" }}>
                        <span>{action.type}</span>
                        <span>action id: {action.id}</span>
                        <span>Client Id: {clientId}</span>
                        <span>State Time: {time}</span>
                    </div>
                ))}
            </div>
            <h2 className="mt-3">Established History</h2>
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
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
            </div>
        </div>
    )
}
