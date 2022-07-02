import { Overview } from "./types"
import * as asyncAPI from "pareto-async-api"

export type GetData = (
    rootDir: string,
    error: (message: string) => void,
) => asyncAPI.IAsync<Overview>

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