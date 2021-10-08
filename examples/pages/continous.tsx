import { ContinousState, ConsistentTimeline, getStateAt, StateType, ContisistentTimelineEntry } from "co-nsistent";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Observable, Subject } from "rxjs";
import { delay, filter } from "rxjs/operators"

export default function Continous() {
    const subject = useMemo(() => new Subject<Event>(), [])
    const clients = useMemo(
        () =>
            new Array(5).fill(null).map((_, i) => {
                const clientId = `#${i}`
                return (
                    <Client
                        key={i}
                        clientId={clientId}
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
    clientId: string
    stateTime: number
}

function reduce(events: Array<Event>, event: Event): Array<Event> {
    return [...events, event]
}

function animationFactory(directionInverted: boolean, basePosition: number): (time: number) => { value: number, directionInverted: boolean } {
    return (time: number) => {
        const seconds = time / 1000
        const absolutePosition = directionInverted ? basePosition + seconds : basePosition - seconds
        return {
            directionInverted,
            value: absolutePosition
        }
    }
}

export function Client({
    clientId,
    sendSubject,
    receiveObservable
}: {
    clientId: string
    sendSubject: Subject<Event>
    receiveObservable: Observable<Event>
}) {
    //const [events, addEventToList] = useReducer(reduce, [])

    const [continousTimeline, setContinousTimeline] = useState<Array<ContisistentTimelineEntry<{
        value: number;
        directionInverted: boolean;
    }>>>([])
    const timeline = useMemo(
        () => {
            const baseHistory: Array<ContisistentTimelineEntry<{
                value: number;
                directionInverted: boolean;
            }>> = [{
                reducer: () => {
                    throw "can't reduce the first state"
                },
                state: {
                    type: StateType.CONTINOUS, value: animationFactory(false, 0)
                },
                stateTime: 0
            }]

            const timeline = new ConsistentTimeline(baseHistory, 0,
                () => new Date().getTime(),
                2000,
                () => {
                    setContinousTimeline([...timeline.history])
                })
            setContinousTimeline([...timeline.history])
            return timeline
        },
        [setContinousTimeline]
    )

    const createLocalEvent = useCallback(
        () => {
            const stateTime = timeline.getCurrentTime()
            const event: Event = {
                clientId,
                stateTime
            }
            timeline.insert(stateTime, ({ directionInverted, value }) => ({
                type: StateType.CONTINOUS,
                value: animationFactory(!directionInverted, value)
            }))
            sendSubject.next(event)
        },
        [clientId, timeline, sendSubject]
    )
    useEffect(() => {
        const subscription = receiveObservable.subscribe((event) => {
            timeline.insert(event.stateTime, ({ directionInverted, value }) => ({
                type: StateType.CONTINOUS,
                value: animationFactory(!directionInverted, value)
            }))
        })
        return () => subscription.unsubscribe()
    }, [timeline, clientId])
    return <div style={{ flexBasis: 0, display: "flex", flexDirection: "column", margin: "1rem", flexGrow: 1, overflow: "hidden" }}>
        <div style={{ border: "1px solid" }}>
            <Point timeline={timeline} />
        </div>
        <button onClick={() => createLocalEvent()}>invert</button>
        {continousTimeline.map((entry, index) => <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column" }} key={index}>
            <span>time: {entry.stateTime}</span>
            <span>value: {getStateAt(entry.stateTime, entry.stateTime, entry.state).value}</span>
        </div>)}
    </div>
}

function Point({ timeline }: { timeline: ConsistentTimeline<{ value: number, directionInverted: boolean }> }) {
    const [marginLeft, setMarginLeft] = useState("0%")
    useEffect(() => {
        const ref = window.setInterval(() => {
            const { value } = timeline.getCurrentState()
            const abs = Math.abs(value)
            const backwards = Math.floor(abs) % 2 === 1
            const boundedValue = backwards ? 1 - (abs % 1) : (abs % 1)
            setMarginLeft(`calc(${(100 * boundedValue).toFixed(3)}% - ${(3 * boundedValue).toFixed(3)}rem)`)
        }, 30)
        return () => window.clearInterval(ref)
    }, [setMarginLeft])
    return <div style={{ width: "3rem", height: "3rem", marginLeft, background: "#f00", borderRadius: "100%" }} />
}