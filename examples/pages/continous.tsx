import { Universe, StateClock, HistoryEntry } from "co-consistent"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Observable, Subject } from "rxjs"
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
                        timeOffset={0}
                        timeVelocity={1}
                        incommingMessageDelay={1000 + Math.random() * 1000}
                        receiveObservable={subject.pipe(filter((e) => e.clientId !== clientId))}
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
    id: number
}

const velocity = 0.0001

type State = {
    value: number
    directionInverted: boolean
}

export function Client({
    clientId,
    sendSubject,
    receiveObservable,
    timeOffset,
    timeVelocity,
    incommingMessageDelay,
}: {
    incommingMessageDelay: number
    timeVelocity: number
    timeOffset: number
    clientId: string
    sendSubject: Subject<Event>
    receiveObservable: Observable<Event>
}) {
    //const [events, addEventToList] = useReducer(reduce, [])

    const [history, setHistory] = useState<
        Array<
        HistoryEntry<
                {
                    value: number
                    directionInverted: boolean
                },
                number
            >
        >
    >([])
    const universe = useMemo(() => {
        const clock = new StateClock(timeOffset, () => new Date().getTime())
        const baseHistory: Array<
        HistoryEntry<
                {
                    value: number
                    directionInverted: boolean
                },
                number
            >
        > = [
            {
                action: 0,
                state: {
                    directionInverted: false,
                    value: 0,
                },
                stateTime: 0,
            },
        ]

        const universe = new Universe<State, number>(
            baseHistory,
            () => ({ value: 0, directionInverted: false }),
            (state) => (state.directionInverted = !state.directionInverted),
            () => true,
            (ref, state, time) => {
                ref.directionInverted = state.directionInverted
                ref.value = state.value + time * (state.directionInverted ? -velocity : velocity)
            },
            (a1, a2) => a1 - a2,
            clock,
            2000,
            () => {
                setHistory([...universe.history])
            }
        )
        setHistory([...universe.history])
        return universe
    }, [setHistory, timeVelocity, timeOffset])

    const smoothedRef = useMemo<{ state: SmoothState | undefined; time: number | undefined }>(
        () => ({ state: undefined, time: undefined }),
        []
    )

    const insert = useCallback(
        (currentTime: number, stateTime: number, id: number) => {
            if (smoothedRef.state != null && smoothedRef.time != null) {
                const deltaTime = currentTime - smoothedRef.time
                smoothedRef.state.value += smoothedRef.state.velocity * deltaTime
                smoothedRef.state.velocity = -smoothedRef.state.velocity
                smoothedRef.time = currentTime
            }
            universe.insert(stateTime, id)
        },
        [universe, smoothedRef]
    )

    const createLocalEvent = useCallback(() => {
        const id = Math.random()
        const stateTime = universe.getCurrentTime()
        const event: Event = {
            clientId,
            stateTime,
            id,
        }
        insert(stateTime, stateTime, id)
        sendSubject.next(event)
    }, [clientId, universe, sendSubject])
    useEffect(() => {
        const subscription = receiveObservable
            .pipe(
                delay(incommingMessageDelay),
                tap((event) => insert(universe.getCurrentTime(), event.stateTime, event.id))
            )
            .subscribe()
        return () => subscription.unsubscribe()
    }, [universe, clientId, insert])

    return (
        <div
            style={{
                flexBasis: 0,
                display: "flex",
                flexDirection: "column",
                margin: "1rem",
                flexGrow: 1,
                overflow: "hidden",
            }}>
            <div style={{ border: "1px solid" }}>
                <Point smoothedRef={smoothedRef} universe={universe} />
            </div>
            <button onClick={() => createLocalEvent()}>invert</button>
            <span>Time offset: {timeOffset}</span>
            <span>Time velocity: {timeVelocity.toFixed(2)}</span>
            <span>Incomming message delay: {incommingMessageDelay.toFixed(0)}</span>
            {history.map((entry, index) => {
                return (
                    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column" }} key={index}>
                        <span>action id: {entry.action.toFixed(3)}</span>
                        <span>time: {entry.stateTime.toFixed(0)}</span>
                        <span>value: {entry.state.value.toFixed(2)}</span>
                    </div>
                )
            })}
        </div>
    )
}

function Point({
    universe,
    smoothedRef,
}: {
    smoothedRef: { state: SmoothState | undefined; time: number | undefined }
    universe: Universe<{ value: number; directionInverted: boolean }, number>
}) {
    const [{ marginLeft, time }, setState] = useState(() => ({
        marginLeft: "0%",
        time: universe.getCurrentTime(),
    }))
    useEffect(() => {
        const realState: State = {
            value: 0,
            directionInverted: false,
        }
        const ref = window.setInterval(() => {
            const realStateTime = universe.getCurrentTime()
            const entry = universe.history[universe.history.length - 1]
            universe.applyStateAt(realState, entry.state, entry.stateTime, realStateTime)
            if (smoothedRef.state == null || smoothedRef.time == null) {
                smoothedRef.state = {
                    value: realState.value,
                    velocity: realState.directionInverted ? -velocity : velocity,
                }
            } else {
                applySmoothing(smoothedRef.state, smoothedRef.time, realState, realStateTime)
                const abs = Math.abs(smoothedRef.state.value)
                const backwards = Math.floor(abs) % 2 === 1
                const boundedValue = backwards ? 1 - (abs % 1) : abs % 1
                setState({
                    marginLeft: `calc(${(100 * boundedValue).toFixed(3)}% - ${(3 * boundedValue).toFixed(3)}rem)`,
                    time: realStateTime,
                })
            }
            smoothedRef.time = realStateTime
        }, 30)
        return () => window.clearInterval(ref)
    }, [setState, smoothedRef])
    return (
        <>
            <span>time: {time.toFixed(0)}</span>
            <div style={{ width: "3rem", height: "3rem", marginLeft, background: "#f00", borderRadius: "100%" }} />
        </>
    )
}

type SmoothState = {
    value: number
    velocity: number
}

function applySmoothing(
    smoothState: SmoothState,
    smoothStateTime: number,
    realState: State,
    realStateTime: number
): void {
    const deltaTime = realStateTime - smoothStateTime
    const velocityReal = realState.directionInverted ? -velocity : velocity
    const valueReal = realState.value
    const valueSmoothed = smoothState.value

    //we are overshooting
    const vd = (velocityReal + (0.05 * (valueReal - valueSmoothed)) / deltaTime) / 1.05
    smoothState.velocity += limitAbs(vd - smoothState.velocity, velocity * deltaTime * 0.1)

    smoothState.value += smoothState.velocity * deltaTime
}

function limitAbs(value: number, limit: number): number {
    return Math.max(-limit, Math.min(limit, value))
}
