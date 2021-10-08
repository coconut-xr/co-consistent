import { ConsistentTimeline, getStateAt, StateType, ContisistentTimelineEntry } from "co-nsistent";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Observable, Subject } from "rxjs";
import { delay, filter, tap } from "rxjs/operators"

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
                        timeOffset={Math.floor(Math.random() * 2000)}
                        timeVelocity={0.5 + Math.random()}
                        incommingMessageDelay={1000 + Math.random() * 1000}
                        receiveObservable={subject.pipe(
                            filter((e) => e.clientId !== clientId)
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
    receiveObservable,
    timeOffset,
    timeVelocity,
    incommingMessageDelay
}: {
    incommingMessageDelay: number
    timeVelocity: number
    timeOffset: number
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

            const timeline = new ConsistentTimeline(baseHistory,
                timeOffset,
                () => new Date().getTime(),
                2000,
                () => {
                    setContinousTimeline([...timeline.history])
                },
                timeVelocity
            )
            setContinousTimeline([...timeline.history])
            return timeline
        },
        [setContinousTimeline, timeOffset, timeVelocity]
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
        const subscription = receiveObservable.pipe(
            delay(incommingMessageDelay),
            tap((event) => {
                timeline.insert(event.stateTime, ({ directionInverted, value }) => ({
                    type: StateType.CONTINOUS,
                    value: animationFactory(!directionInverted, value)
                }))
            })
        ).subscribe()
        return () => subscription.unsubscribe()
    }, [timeline, clientId])
    return <div style={{ flexBasis: 0, display: "flex", flexDirection: "column", margin: "1rem", flexGrow: 1, overflow: "hidden" }}>
        <div style={{ border: "1px solid" }}>
            <Point timeline={timeline} />
        </div>
        <button onClick={() => createLocalEvent()}>invert</button>
        <span>Time offset: {timeOffset}</span>
        <span>Time velocity: {timeVelocity.toFixed(2)}</span>
        <span>Incomming message delay: {incommingMessageDelay.toFixed(0)}</span>
        {continousTimeline.map((entry, index) => <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column" }} key={index}>
            <span>time: {entry.stateTime.toFixed(0)}</span>
            <span>value: {getStateAt(entry.stateTime, entry.stateTime, entry.state).value.toFixed(2)}</span>
        </div>)}
    </div>
}

function Point({ timeline }: { timeline: ConsistentTimeline<{ value: number, directionInverted: boolean }> }) {
    const [{ marginLeft, time }, setState] = useState(() => ({
        marginLeft: "0%",
        time: timeline.getCurrentTime()
    }))
    useEffect(() => {
        const ref = window.setInterval(() => {
            const currentTime = timeline.getCurrentTime()
            const entry = timeline.history[timeline.history.length - 1]
            const { value } = getStateAt(currentTime, entry.stateTime, entry.state)
            const abs = Math.abs(value)
            const backwards = Math.floor(abs) % 2 === 1
            const boundedValue = backwards ? 1 - (abs % 1) : (abs % 1)
            setState({
                marginLeft: `calc(${(100 * boundedValue).toFixed(3)}% - ${(3 * boundedValue).toFixed(3)}rem)`,
                time: currentTime
            })

        }, 30)
        return () => window.clearInterval(ref)
    }, [setState])
    return <>
        <span>time: {time.toFixed(0)}</span>
        <div style={{ width: "3rem", height: "3rem", marginLeft, background: "#f00", borderRadius: "100%" }} />
    </>
}