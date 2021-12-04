import { Universe, Clock, HistoryEntry, State } from "co-consistent"
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
                        //timeVelocity={1}
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

type Action = {
    type: "init" | "invert"
    id: number
}

class ContinousState implements State<Action> {
    constructor(public value: number, public directionInverted: boolean) {}

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
        if (
            action?.type == "invert" &&
            base.directionInverted === prevBase?.directionInverted &&
            base.value === prevBase?.value &&
            prevDeltaTime === deltaTime
        ) {
            return
        }
        this.value = base.value + deltaTime * (base.directionInverted ? -velocity : velocity)
        this.directionInverted = action == null ? base.directionInverted : !base.directionInverted
    }

    copyFrom(ref: this): void {
        this.directionInverted = ref.directionInverted
        this.value = ref.value
    }
}

export function Client({
    clientId,
    sendSubject,
    receiveObservable,
    timeOffset,
    //timeVelocity,
    incommingMessageDelay,
}: {
    incommingMessageDelay: number
    //timeVelocity: number
    timeOffset: number
    clientId: string
    sendSubject: Subject<Event>
    receiveObservable: Observable<Event>
}) {
    //const [events, addEventToList] = useReducer(reduce, [])
    const clock = useMemo(
        () => new Clock(timeOffset, () => (global.window == null ? 0 : window.performance.now())),
        [timeOffset]
    )
    const [history, setHistory] = useState<Array<HistoryEntry<ContinousState, Action>>>([])
    const universe = useMemo(() => {
        const universe = new Universe(
            () => new ContinousState(0, false),
            (a1, a2) => a1.id - a2.id,
            2000,
            () => {
                setHistory([...universe.history])
            }
        )
        universe.insert(
            {
                id: Math.random(),
                type: "init",
            },
            clock.getCurrentTime(),
            0,
            new ContinousState(0, false)
        )
        setHistory([...universe.history])
        return universe
    }, [clock, setHistory, timeOffset])

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
            universe.insert(
                {
                    type: "invert",
                    id,
                },
                currentTime,
                stateTime
            )
        },
        [universe, smoothedRef]
    )

    const createLocalEvent = useCallback(() => {
        const id = Math.random()
        const currentTime = clock.getCurrentTime()
        const event: Event = {
            clientId,
            stateTime: currentTime,
            id,
        }
        insert(currentTime, currentTime, id)
        sendSubject.next(event)
    }, [clientId, clock, universe, sendSubject])
    useEffect(() => {
        const subscription = receiveObservable
            .pipe(
                delay(incommingMessageDelay),
                tap((event) => {
                    let currentTime = clock.getCurrentTime()
                    if (event.stateTime > currentTime) {
                        clock.jump(event.stateTime - currentTime)
                        currentTime = clock.getCurrentTime()
                    }
                    insert(currentTime, event.stateTime, event.id)
                })
            )
            .subscribe()
        return () => subscription.unsubscribe()
    }, [clock, universe, clientId, insert])

    //<span>Time velocity: {timeVelocity.toFixed(2)}</span>

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
                <Point clock={clock} smoothedRef={smoothedRef} universe={universe} />
            </div>
            <button onClick={() => createLocalEvent()}>invert</button>
            <span>Time offset: {timeOffset}</span>
            <span>Incomming message delay: {incommingMessageDelay.toFixed(0)}</span>
            {history.map((entry, index) => {
                return (
                    <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column" }} key={index}>
                        <span>action id: {entry.action.id.toFixed(3)}</span>
                        <span>time: {entry.time.toFixed(0)}</span>
                        <span>value: {entry.result.value?.toFixed(2)}</span>
                    </div>
                )
            })}
        </div>
    )
}

function Point({
    universe,
    smoothedRef,
    clock,
}: {
    smoothedRef: { state: SmoothState | undefined; time: number | undefined }
    universe: Universe<ContinousState>
    clock: Clock
}) {
    const [{ marginLeft, time }, setState] = useState(() => ({
        marginLeft: "0%",
        time: clock.getCurrentTime(),
    }))
    useEffect(() => {
        const realState = new ContinousState(0, false)
        const ref = window.setInterval(() => {
            const realStateTime = clock.getCurrentTime()
            const entry = universe.history[universe.history.length - 1]
            universe.applyStateAt(realState, entry, realStateTime)
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
    }, [clock, setState, smoothedRef])
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
    realState: ContinousState,
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
