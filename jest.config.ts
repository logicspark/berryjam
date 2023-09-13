import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
	preset: "ts-jest",
	testEnvironment: "node",
	transform: {
		// '^.+\\.[tj]sx?$' to process js/ts with `ts-jest`
		// '^.+\\.m?[tj]sx?$' to process js/ts/mjs/mts with `ts-jest`
		"^.+\\.ts?$": [
			"ts-jest",
			{
				useESM: true,
				diagnostics: {
					ignoreCodes: ["TS151001"],
				},
			},
		],
	},
};

export default jestConfig;
