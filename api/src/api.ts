import { Overview } from "./types"
import * as pa from "pareto-api-core"

export type GetData = (
    rootDir: string,
    error: (message: string) => void,
) => pa.IAsync<Overview>

export type Report = (
    res: Overview,
    console: {
        log: (message: string) => void
    }
) => void

export type API = {
    getData: GetData,
    report: Report,
}