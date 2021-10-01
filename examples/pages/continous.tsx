import { ContinousState, ContinousTimeline, ContinousTimelineEntry, continousTimelineEntryToArray, getStateAt, StateType } from "co-vectorize";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Observable, Subject } from "rxjs";
import { delay, filter } from "rxjs/operators"

export default function Continous() {
    const subject = useMemo(() => new Subject<Event>(), [])
    const globalBaseTime = useMemo(() => new Date().getTime(), [])
    const clients = useMemo(
        () =>
            new Array(5).fill(null).map((_, i) => {
                const clientId = `#${i}`
                return (
                    <Client
                        key={i}
                        globalBaseTime={globalBaseTime}
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
    globalTime: number
}

function reduce(events: Array<Event>, event: Event): Array<Event> {
    return [...events, event]
}

function animationFactory(directionInverted: boolean, basePosition: number, baseGlobalTime: number): (time: number) => { value: number, directionInverted: boolean } {
    return (time: number) => {
        const seconds = ((time - baseGlobalTime) / 1000)
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
    globalBaseTime
}: {
    globalBaseTime: number,
    clientId: string
    sendSubject: Subject<Event>
    receiveObservable: Observable<Event>
}) {
    //const [events, addEventToList] = useReducer(reduce, [])

    const [state, seState] = useState<State>({
        type: StateType.STATIC, value: {
            value: 0,
            directionInverted: false
        }
    })
    const [continousTimeline, setContinousTimeline] = useState<Array<ContinousTimelineEntry<{
        value: number;
        directionInverted: boolean;
    }>>>([])
    const timeline = useMemo(
        () => {
            const baseState: State = {
                type: StateType.CONTINOUS, value: animationFactory(false, 0, globalBaseTime)
            }

            seState(baseState)
            const timeline = new ContinousTimeline(baseState, globalBaseTime, (time) => time < new Date().getTime() - 2000, (entry) => {
                seState(entry.state)
                setContinousTimeline(continousTimelineEntryToArray(entry))
            })
            setContinousTimeline(continousTimelineEntryToArray(timeline.currentEntry))
            return timeline
        },
        [globalBaseTime, seState, setContinousTimeline]
    )

    const createLocalEvent = useCallback(
        () => {
            const globalTime = new Date().getTime()
            const event = {
                clientId,
                globalTime
            }
            timeline.insert(globalTime, ({ directionInverted, value }) => ({
                type: StateType.CONTINOUS,
                value: animationFactory(!directionInverted, value, globalTime)
            }))
            sendSubject.next(event)
        },
        [clientId, timeline, sendSubject]
    )
    useEffect(() => {
        const subscription = receiveObservable.subscribe((event) => {
            timeline.insert(event.globalTime, ({ directionInverted, value }) => ({
                type: StateType.CONTINOUS,
                value: animationFactory(!directionInverted, value, event.globalTime)
            }))
        })
        return () => subscription.unsubscribe()
    }, [timeline, clientId])
    return <div style={{ flexBasis: 0, display: "flex", flexDirection: "column", margin: "1rem", flexGrow: 1, overflow: "hidden" }}>
        <div style={{ border: "1px solid" }}>
            <Point state={state} />
        </div>
        <button onClick={() => createLocalEvent()}>invert</button>
        {continousTimeline.map((entry, index) => <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column" }} key={index}>
            <span>time: {entry.globalTime}</span>
            <span>value: {getStateAt(entry.globalTime, entry.state).value}</span>
        </div>)}
    </div>
}

type State = ContinousState<{ value: number, directionInverted: boolean }>

function Point({ state }: { state: State }) {
    const [marginLeft, setMarginLeft] = useState("0%")
    useEffect(() => {
        const ref = window.setInterval(() => {
            const time = new Date().getTime()
            const { value } = getStateAt(time, state)
            const abs = Math.abs(value)
            const backwards = Math.floor(abs) % 2 === 1
            const boundedValue = backwards ? 1 - (abs % 1) : (abs % 1)
            setMarginLeft(`calc(${(100 * boundedValue).toFixed(3)}% - ${(3 * boundedValue).toFixed(3)}rem)`)
        }, 30)
        return () => window.clearInterval(ref)
    }, [setMarginLeft, state])
    return <div style={{ width: "3rem", height: "3rem", marginLeft, background: "#f00", borderRadius: "100%" }} />
}