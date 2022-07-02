import * as asyncAPI from "pareto-async-api"

export type Part = {
    isPublic: boolean
    packageData: PackageData | null
}

export type Project = {
    gitClean: boolean
    parts: asyncAPI.IDictionary<Part>
}

export type Overview = {
    projects: asyncAPI.IDictionary<Project>
}

export type PackageData = {
    name: string | null,
    version: string | null,
    contentFingerprint: string | null,
    dependencies: asyncAPI.IDictionary<Depencency>
    devDependencies: asyncAPI.IDictionary<Depencency>
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