import * as pa from "pareto-api-core"

export type Part = {
    isPublic: boolean
    packageData: PackageData | null
}

export type Project = {
    gitClean: boolean
    parts: pa.IReadonlyDictionary<Part>
}

export type Overview = {
    projects: pa.IReadonlyDictionary<Project>
}

export type PackageData = {
    name: string | null,
    version: string | null,
    contentFingerprint: string | null,
    dependencies: pa.IReadonlyDictionary<Depencency>
    devDependencies: pa.IReadonlyDictionary<Depencency>
    remote: RemoteData | null
}


export type RemoteData = {
    latestVersion: null | string
    contentFingerprint: null | string
}

export type Depencency = {
    version: string
    remote: RemoteData | null
}