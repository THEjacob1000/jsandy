import { afterAll, beforeEach, spyOn } from "bun:test";

const spyFetch = spyOn(globalThis, "fetch");

beforeEach(() => {
	spyFetch.mockReset();
});

afterAll(() => {
	spyFetch.mockRestore();
});
