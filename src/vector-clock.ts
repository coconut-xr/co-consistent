/**
 * VectorClock where each entry is the local clock increased with each local event
 */
export type VectorClock = {
    [identifier in string]?: number
}

export function vectorClockIncrease(target: VectorClock, clientId: string, by: number): void {
  target[clientId] = (target[clientId] ?? 0) + by
}

export function vectorClockMax(target: VectorClock, by: VectorClock): void {
  const keys = new Set([...Object.keys(target), ...Object.keys(by)])
  keys.forEach((key) => {
    target[key] = Math.max(target[key] ?? 0, by[key] ?? 0)
  })
}

/**
 * compare two vector clocks to determine a global consistent happend before relation
 * @param v1 vector clock 1
 * @param v2 vector clock 2
 * @returns whether v1 <= v2 (v1 happend before v2)
 */
export function compareVectorClocksAbsolutely(
    v1ClientId: string,
    v1: VectorClock,
    timestampV1: number,
    v2ClientId: string,
    v2: VectorClock,
    timestampV2: number
): VectorClockRelation.AFTER | VectorClockRelation.BEFORE | VectorClockRelation.EQUAL {
    const relation = compareVectorClocks(v1, v2)
    if (relation === VectorClockRelation.PARALLEL) {
        return (timestampV1 === timestampV2 ? v1ClientId < v2ClientId : timestampV1 < timestampV2)
            ? VectorClockRelation.BEFORE
            : VectorClockRelation.AFTER
    } else {
        return relation
    }
}

export enum VectorClockRelation {
    BEFORE,
    AFTER,
    PARALLEL,
    EQUAL,
}

export function compareVectorClocks(v1: VectorClock, v2: VectorClock): VectorClockRelation {
    const keys = new Set([...Object.keys(v1), ...Object.keys(v2)])
    let v1OneGreater = false //greater or equal
    let v1OneSmaller = false //smaller or equal
    keys.forEach((key) => {
        const vE1 = v1[key] ?? 0
        const vE2 = v2[key] ?? 0
        if (vE1 < vE2) {
            v1OneSmaller = true
        }
        if (vE1 > vE2) {
            v1OneGreater = true
        }
    })
    if (!v1OneGreater && !v1OneSmaller) {
        return VectorClockRelation.EQUAL
    } else if (v1OneGreater && v1OneSmaller) {
        return VectorClockRelation.PARALLEL
    } else if (v1OneGreater) {
        return VectorClockRelation.AFTER
    } else {
        return VectorClockRelation.BEFORE
    }
}
