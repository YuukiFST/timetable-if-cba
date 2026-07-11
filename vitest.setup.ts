import { JSDOM } from "jsdom"

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://localhost" })
const { window } = dom

Object.defineProperty(globalThis, "window", { value: window, configurable: true })
Object.defineProperty(globalThis, "localStorage", { value: window.localStorage, configurable: true })
Object.defineProperty(globalThis, "document", { value: window.document, configurable: true })
